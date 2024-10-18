#!/bin/bash
export REACT_APP_API_URL=https://192.168.0.119:3001/api
node server.js &
serve -s frontend -l 3000 --ssl-cert cert.pem --ssl-key key.pem