#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts create-user-playbook.yml \
  -e "user={{ _ansbl_username }}" \
  -e "password={{ _ansbl_password }}" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key