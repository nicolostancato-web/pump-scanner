#!/usr/bin/env python3
"""
Minimal startup — Flask only, no agents.
Used to diagnose Railway deployment issues.
"""
import os
import sys
import logging
import traceback

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("wolf-minimal")

log.info("=" * 50)
log.info("Wolf v4 minimal start")
log.info(f"Python: {sys.version}")
log.info(f"PORT env: {os.environ.get('PORT', 'NOT SET')}")
log.info(f"PWD: {os.getcwd()}")
log.info(f"Files: {os.listdir('.')}")

try:
    log.info("Importing Flask...")
    from flask import Flask
    log.info("Flask OK")
    
    log.info("Importing waitress...")
    from waitress import serve
    log.info("waitress OK")

    log.info("Importing dashboard.app...")
    from dashboard.app import app
    log.info("dashboard.app OK")

except Exception as e:
    log.error(f"IMPORT FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)

port = int(os.environ.get("PORT", 8080))
log.info(f"Starting waitress on 0.0.0.0:{port}")

try:
    serve(app, host="0.0.0.0", port=port, threads=4)
except Exception as e:
    log.error(f"SERVER FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
