#!/bin/bash

target=$([ -z $1 ] && echo "labservers" || echo "$1")

ansible-playbook -i hosts create-user-playbook.yml \
  -e "user={{ _ansbl_username }}" \
  -e "password={{ _ansbl_password }}" \
  -e "user_groups={{ ['sudo', 'misl'] | list }}" \
  -e "target_hosts=$target" \
  --vault-password-file ./secret_key

ansible-playbook -i hosts main-playbook.yml \
  -e "is_install_pip_packages=True" \
  -e "target_hosts=$target" \
  -e "ansible_ssh_user={{ _ansbl_username }}" \
  -e "ansible_ssh_pass={{ _ansbl_password }}" \
  --vault-password-file ./secret_key