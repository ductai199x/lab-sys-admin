#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts main-playbook.yml \
  -e "is_update_upgrade=True" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key