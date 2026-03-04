#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts main-playbook.yml \
  -e "is_reboot=True" \
  -e "user_choice=ansible" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key