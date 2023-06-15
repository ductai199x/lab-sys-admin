#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts create-user-playbook.yml \
  -e "ansible_ssh_user={{ _ansbl_username }}" \
  -e "ansible_ssh_pass={{ _ansbl_password }}" \
  -e "ansible_become_password={{ _ansbl_password }}" \
  -e "user=$2" \
  -e "password=$3" \
  -e "user_groups={{ ['misl'] | list }}" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key

ansible-playbook -i hosts main-playbook.yml \
  -e "is_install_pip_packages=True" \
  -e "target_hosts=$target" \
  -e "ansible_ssh_user=$2" \
  -e "ansible_ssh_pass=$3" \
  --vault-password-file ./secret_key