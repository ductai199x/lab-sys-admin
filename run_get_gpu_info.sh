#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

rebuild_webpage=$([ -z $2 ] && echo "False" || echo "True")

ansible-playbook -i hosts main-playbook.yml \
  -e "is_get_gpu_info=True" \
  -e "target_hosts=$target" \
  -e "is_rebuild_webpage=$rebuild_webpage" \
  --vault-password-file ./secret_key
