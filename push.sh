#!/bin/bash
MSG="${1:-Update submission}"

git add -A
git commit -m "$MSG"
git push origin master 2>&1

echo "Pushed to GitHub!"