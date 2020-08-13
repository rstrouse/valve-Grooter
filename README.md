# Valve Grooter
 This is an application to send messages to IntelliValve in the hope that it will respond with some message other than "I am Groot."  Whenever plugged into an RS485 port IntelliValve will emit a message with the following format.  Each of the segments below represent the message emitted by the valve.  The first array is a preamble that is always 255, 0, 255 decimal.  This is followed by a header that is always constant [<controller byte><channel><destination><source><action><length>].  The next array is the payload where the X's represent a unique identifier.  All valves witnessed in the wild contain a unique set of bytes for the valve.  The final two bytes are simply a checksum that is calculated for the message.
 ```[255,0,255][165,1,16,12,82,8][0,128,XXX,XXX,XXX,XXX,XXX,XXX][NN,NN]```
 
 ## Things we know about Groot
 At this point this is the only means of communication that the valve has.  Despite the traffic on the RS485 bus all we can get the valve to respond with is "I am Groot."  This message is consistent for regardless of the mode that the valve is in.  The XXX bytes on the payload described above appear to be some sort of unique identifier for the valve.  Valves manufactured around the same time appear to have some level of sequential numbering in the lower order bytes.
 
 ## What this software does
 This software sends messages out on the RS485 bus in the hopes that the valve will call us dad.  This means that we get some other message than "I am Groot!"

 ## Installation
 For the message processor to be effective, the only thing on the RS485 adapter should be a single IntelliValve.  If there is any other traffic, then the chatter from those devices may be interpreted for intelligence from the valve.  You must hook up at least one side of the valve to a 24vac with at least 1amp of power.  The green and yellow wires from the IntelliValve should be hooked to your RS485 adapter.
 
 
 Once you have cloned the repository run ```nmp install``` then run ```npm start```.  On first run the application will create a config.json file.  If your RS485 adapter is not recognized or you want to change the web port for the built-in status page you can edit these settings in the config.json located in the root directory of the application.

 Most of the settings for the valve-Grooter are the same as those set for [nodejs-PoolController](https://github.com/tagyoureit/nodejs-poolController#controller-section---changes-to-the-communications-for-the-app).  In fact they use the same message processing and configuration code.
 
 ## Message status
 A simple webpage has been created that will show you the status of the messages that are emitted to the valve.  These begin only after the valve has sent its first groot message to the controller.  To launch the page open a browser after starting the valve-Grooter server and type ```http://<valve grooter server ip>:8986``` or if you changed the port and/or ip address use the port that you assigned to it in the config.json file.
  
 As the messages are sent to IntelliValve the page will refresh with the latest data that has been sent to the valve.  If there are any responses from it please upload your ```equipmentConfig.json``` file in the issues section.  Don't get too excited the response indicated in the screenshot is "I am Groot!"
 
  ![image](https://user-images.githubusercontent.com/47839015/90079929-29b75880-dcbe-11ea-8ccd-6581ebfcbcdd.png)
  
 
 
 # Happy Grooting!  We are all grooting for you!
 
 

