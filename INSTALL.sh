#!/bin/bash

# Default Installation Directory
installDir=~/.local/share/gnome-shell/extensions

if [ ! -z $1 ]
then
  installDir=$1
fi

if [ ! -d $installDir ]
then
  if [ -z $2 ]
  then
    echo $installDir"     directory does not exist."
    echo "Would you like to create the directory  (y/n) ? "
    read response
  else
    response=$2
  fi
  
  if [ $response == "y" ]
  then
    mkdir -p $installDir
    if [ $? -eq 0 ]
    then
      echo " Directory Created "
    else
      echo " Error ! "
      exit
    fi
  else
    echo "Exiting ... ! "
    exit
  fi
fi

echo "Installing Path "$installDir
echo "Removing any Older Version"
rm -rf $installDir"/notification-center@Selenium-H"
echo "Done"

echo "Copying New Version"
cp -rf notification-center@Selenium-H $installDir
echo "Done"

cd $installDir"/notification-center@Selenium-H"
echo "Compiling Schemas"
glib-compile-schemas schemas
echo "Done"

cd locale
echo "Creating Translations"
mkdir it/LC_MESSAGES
msgfmt it/notification-center.po -o it/LC_MESSAGES/notification-center.mo
echo "All Done !"
