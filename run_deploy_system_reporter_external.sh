#!/bin/bash
# Deploy system_reporter agent to external machines (outside the private network).
# Requires ngrok to be configured to expose Redis.
#
# Usage:
#   ./run_deploy_system_reporter_external.sh <target_hosts>
#
# The target hosts must be defined in the inventory with:
#   system_reporter_redis_host  - ngrok endpoint hostname
#   system_reporter_redis_port  - ngrok endpoint port
#
# Example inventory entry:
#   [external_servers]
#   myhost ansible_ssh_host=203.0.113.10 ansible_user=myuser system_reporter_redis_host=0.tcp.ngrok.io system_reporter_redis_port=12345

if [ -z "$1" ]; then
  echo "Usage: $0 <target_hosts>"
  echo "  e.g. $0 external_servers"
  exit 1
fi

target="$1"

ansible-playbook -i hosts main-playbook.yml \
  -e "is_deploy_system_reporter=True" \
  -e "system_reporter_ngrok_enabled=True" \
  -e "user_choice=ansible" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key
