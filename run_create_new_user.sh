#!/bin/bash

target=$([ -z $3 ] && echo "labservers" || echo "$3")

ansible-playbook -i hosts create-user-playbook.yml \
  -e "user=$1" \
  -e "password=$2" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key