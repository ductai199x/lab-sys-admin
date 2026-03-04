#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts main-playbook.yml \
  -e "is_install_pip_packages=True" \
  -e "target_hosts=$target" \
  -e "ansible_ssh_user=$2" \
  -e "ansible_ssh_pass=$3" \
  --vault-password-file ./secret_key