#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")
user=$([ -z $2 ] && echo "admin" || echo "$2")

ansible-playbook -i hosts main-playbook.yml \
  -e "is_install_pip_packages=True" \
  -e "target_hosts=$target" \
  -e "user_choice=$user" \
  --vault-password-file ./secret_key