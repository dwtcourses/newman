from __future__ import with_statement

from app import app
from flask import request, jsonify
from werkzeug.exceptions import BadRequest

import threading
import subprocess

import os
import sys
import traceback
import datetime
import uuid
import time

from newman_es.es_search import initialize_email_addr_cache
from utils.file import spit
from newman_es.config.newman_config import index_creator_prefix


SITE_ROOT = os.path.realpath(os.path.dirname(__file__))

BASE_DIR = os.path.abspath("{}/../".format(SITE_ROOT))
WORK_DIR = os.path.abspath("{}/../work_dir/".format(SITE_ROOT))
ingest_parent_dir = "/vagrant/newman-ingester/"

_INGESTER_LOCK=threading.Lock()
_INGESTER_CONDITION=threading.Condition(_INGESTER_LOCK)

INGESTER_AVAILABLE=0
INGESTER_BUSY=1


def fmtNow():
    return datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')

# TODO need to add an ingest id for monitoring specific ingests
@app.route('/ingester/status')
def ingest_status(*args, **kwargs):
    if not _INGESTER_LOCK.locked():
        return jsonify({"status_code" : INGESTER_AVAILABLE, "status_message" : "Ingester available."})
    return jsonify({"status_code" : INGESTER_BUSY, "status_message" : "Currently ingesting, please see logs for detailing information."})

@app.route('/ingester/ingest_id')
def get_ingest_id():
    '''
     nanoseconds = int(time.time() * 1e9)
    # 0x01b21dd213814000 is the number of 100-ns intervals between the
    # UUID epoch 1582-10-15 00:00:00 and the Unix epoch 1970-01-01 00:00:00.
    timestamp = int(nanoseconds/100) + 0x01b21dd213814000L
    create a time based uuid1. can get time back with uuid.time
    :return: json containing the id
    '''
    u = uuid.uuid1(clock_seq=long(time.time()*1e9))
    dt = datetime.datetime.fromtimestamp((u.time - 0x01b21dd213814000L)*100/1e9)
    str_time = dt.strftime('%Y-%m-%dT%H:%M:%S')
    return jsonify({"ingest_id" : str(u), "datetime" : str_time})

@app.route('/ingester/cases')

def list_cases():
    path = os.path.normpath(ingest_parent_dir)
    if not path:
        return jsonify({"message" : "Ensure parent directory exists and is readable by user: " + ingest_parent_dir })
    contents_cases = os.listdir(path)
    cases = {}
    for case in contents_cases:
        if not os.path.isdir(path+"/"+case):
            continue
        case_dir = os.listdir(path+"/"+case)
        if not case in cases:
            cases[case] = {}
        for type in case_dir:
            type_dir = path+"/"+case+"/"+type
            if type in ["emls", "mbox", "pst"] and os.path.isdir(type_dir):
                contents_datasets = os.listdir(type_dir)
                datasets = [ds for ds in contents_datasets if os.path.isdir(type_dir+"/"+ds)]
                if not type in cases[case]:
                    cases[case][type] = {}
                cases[case][type]=datasets

    return jsonify({"cases" : cases})


@app.route('/ingester/extract', methods=['POST'])
def extract():
    '''
    case-id - used to group multiple ingests
    ingest-id - id for a single execution of ingest
    alternate-id - product_id or external id reference
    label - user label for ingest

    file - name of file to ingest
    type - type of ingest pst|mbox|eml
    {"case_id" : "email@x.y_case", "ingest_id" : "<AUTOGENERATED>", "alt_ref_id" : "email@x.y_ref", "label":"email@x.y_label", "type":"mbox", "force_language":"en"}
    '''
    global _INGESTER_CONDITION

    params = request.get_json()
    app.logger.info(params)

    try:
        case_id = params["case_id"]
        ingest_id = params["ingest_id"]
        alt_ref_id = params["alt_ref_id"]
        label = params["label"]
        type = params["type"]
        force_language = params.get("force_language", "en")
    except KeyError as ke:
        raise BadRequest("Request is missing param key/value for '{}'".format(ke.message))

    # path = "{}/{}".format(ingest_parent_dir, type)
    if not ingest_id or not type:
        raise TypeError("Encountered a 'None' value for 'email', 'type''")

    # Add the prefix for the newman indexes
    ingest_id = index_creator_prefix() + ingest_id

    logname = "{}_{}_{}_{}".format(case_id,type,label, fmtNow())
    ingester_log = "{}/{}.ingester.log".format(WORK_DIR, logname)
    # errfile = "{}/{}.err.log".format(work_dir, logname)
    service_status_log = "{}/{}.status.log".format(WORK_DIR, logname)

    spit(service_status_log, "[Start] email address={}\n".format(ingest_id), True)

    def extract_thread():
        try:
            if not _INGESTER_CONDITION.acquire(False):
                spit(service_status_log, "Ingester is currently processing data, you must wait until current ingest is completed before ingesting again.  If you believe this is an error check the ingester logs.")
                return
            else:
                args = ["./bin/ingest.sh", ingest_id, ingest_parent_dir, type, case_id, alt_ref_id, label, force_language]

                app.logger.info("Running ingest: {}".format(" ".join(args)))

                spit(service_status_log, "[Running] {} \n".format(" ".join(args)))

                with open(ingester_log, 'w') as t:
                    kwargs = {'stdout': t, 'stderr': t, 'cwd': BASE_DIR, 'bufsize' : 1 }
                    subp = subprocess.Popen(args, **kwargs)
                    out, err = subp.communicate()

                    rtn = subp.returncode
                    if rtn != 0:
                        app.logger.error("Ingester return with non-zero code: {} \n".format(rtn))
                        spit(service_status_log, "[Error] Ingester return with non-zero code: {} \n".format(rtn))
                    else:
                        app.logger.info("Done Ingesting data.  Reloading the email_addr cache.")
                        spit(service_status_log, "[Done Ingesting data.  Reloading the email_addr cache.]")
                        initialize_email_addr_cache(ingest_id, update=True)
                        spit(service_status_log, "[Complete.]")
        except Exception as e:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            spit(service_status_log, "[Error] <{}>\n".format(e))
            tb = traceback.extract_tb(exc_traceback)
            spit(service_status_log,"[Error] <{}>\n".format(tb))
        finally:
            _INGESTER_CONDITION.release()

    if not _INGESTER_LOCK.locked():
        thr = threading.Thread(target=extract_thread, args=())
        thr.start()
        return jsonify({'log' : logname })

    return jsonify({'log' : logname, 'status' : "Ingester is currently processing data, you must wait until current ingest is completed before ingesting again.  If you believe this is an error check the ingester logs." })
