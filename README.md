# Valve Grooter
 This is an application to send messages to IntelliValve in the hope that it will respond with some message other than "I am Groot."  Whenever plugged into an RS485 port IntelliValve will emit a message with the following format.  Each of the segments below represent the message emitted by the valve.  The first array is a preamble that is always 255, 0, 255 decimal.  This is followed by a header that is always constant [<controller byte><channel><destination><source><action><length>].  The next array is the payload where the X's represent a unique identifier.  All valves witnessed in the wild contain a unique set of bytes for the valve.  The final two bytes are simply a checksum that is calculated for the message.
 ```[][255,0,255][165,1,16,12,82,8][0,128,XXX,XXX,XXX,XXX,XXX,XXX][NN,NN]```
 
 ## Things we know about Groot
 At this point this is the only means of communication that the valve has.  Despite the traffic on the RS485 bus all we can get the valve to respond with is "I am Groot."  This message is consistent regardless of the mode that the valve is in.  The XXX bytes on the payload described above appear to be some sort of unique identifier for the valve.  Valves manufactured around the same time appear to have some level of sequential numbering in the lower order bytes.
 
 ### Counting the screws in Groot
 Like all pressed board furniture the first page of the manual is an inventory of the items in the box.  So here we go with the unboxing and taking inventory of what is in the Groot box.  The message consists of a series of bytes (8-bits) sent in sequence over the green and yellow wires.  We won't go into the TV magic used to translate bits into bytes but just know that it is a series of pulses where 8 of them (0 or 1) make up a byte. 
 
 The protocol is in the expected format and it is recognizable.  This is the same protocol used for most RS485 pool equipment out there and it is just as quippy as any other Avenger.  We have taken some of the mystery out of the message and came up with a relatively easy to understand format.  The way the Grooter shows this information is in 4 arrays (an array is simply a list of bytes) separated by brackets.  A brief description of each of these sections is described below.
 ```[][255,0,255][165,1,16,12,82,8][0,128,XXX,XXX,XXX,XXX,XXX,XXX][NN,NN]```
 
 #### Padding
 The first set of brackets is the padding.  These bytes really have little meaning they are simply any bytes that are not part of a current message.  The most consistent reason that there will be bytes there is that our valve burped.  Who knows maybe the valve can burp the Preamble to the Constitution.  Had a friend in grade school that could do that.  And another one that could run a spaghetti noodle through his sinus out each nostril... but I digress.  Think of this as the packing material that gets all over the place when you open the box.
 
 #### Preamble
  A preamble is simply a notificaton on the RS485 bus that important information is coming.  Unlike the burping above this tells us to be on the lookout for the upcoming bytes. This value will always be ```[255,0,255]```.  In the furniture assembly manual this section is typically bounded by a thick box and a caution symbol.  "Wear goggles and don't stick the screwdriver in your eye!"  You probably shouldn't eat the dessicant pack either.
  
 #### Header
   The header for the message is consistent for all Groot messages on any valve.  It always comes in the form ```[165,1,16,12,82,8]```.  You can always recognize "I am Groot!" by this header.  We will look at each of these bytes to try to make sense of them.
   
   Each number below corresponds to a byte in the header starting from the left where the first byte is 0.
   
   ***0.*** 165 = This byte is always 165 on our protocol.  Any message sent on the RS485 bus including but not limited to our valve will be 165.  One could argue that it is part of the preamble but we look at this byte as the start of the header.  Later on you will understand why this is considered a header byte.
   
   ***1.*** 1 = The channel that the message is being communicated on.  This value has very little consistency on messages picked up on the bus.  In the wild we have witnessed, 0, 32, 33, and 65 depending on the equipment that is sending it.  At this point we are continuing to communicate using 1 as the channel.
   
   ***2.*** 16 = The destination address of the message.  While the rules for this are not really cut and dried, a destination of 16 typically means Broadcast or "To whom it may concern." 
   
   ***3.*** 12 = The source address of the message.  The typical pattern for source addresses is one where the value tells us more specificity as to which physical piece of equipment sent the message.  In this instance we believe that 12 is actually a hail message.  We have witnessed this value only once before with iChlor to announce its presence.  Think of it as the "I am" portion of the "I am Groot!" declaration.
   
   ***4.*** 82 = The action or command of the message.  Put another way this is supposed to identify the reason for the message.  When sending messages back to the valve we have to specify a valid value here so the valve knows what to do with it.  When we get the right combination of bytes, this will be specific for things like "What mode are you in?" or "Set the setponts to XXX,XXX?"
   
   ***5.*** 8 = Length of the upcoming payload.  This byte simply tells us how many bytes we need to read for the next section of the message.  In this case there are 8 btyes.
   
 #### Payload
 The payload is the data portion of the message.  Up until this section every valve in the wild is expected to serve the same series of bytes.  If you bought a nightstand with that cheap bookshelf from the same company, the manual will be the same up until here.  Now it starts to get interesting.

```[0,128,XXX,XXX,XXX,XXX,XXX,XXX]``` The places where you see the X's are simply those places where different valves have emitted different values.  These always start with ```0,128```.  This could mean several things.  Perhaps it is simply letting us know that the range of the valve setpoints is 0 to 128 or it could also be an identifier as to the manufacturer of the valve.  Just know that every valve we have seen so far is an IntelliValve created by Pentair. Either way, these bytes have been consistent on every instance.
    
Now that we know the first two bytes 0 and 1.  Byte 2 through 7 starts giving us more specific information about the valve.  What we have noticed is that in every instance of a valve in the wild these 6 bytes are unique for every valve.  If you are from Blechley Park, perhaps you may see some pattern in this that lines up with the markings on the valve.  If you see a good pattern here let us know.  We do know that byte 2 and 3 roughly match the timeframe from when the valve was manufactured.  We have seen ```216,128``` for older valves and ```128,31``` for valves made after December 2018.

Byte 4 has some consistency with the bytes 2 & 3 as they relate to the time of manufacture.  We have only witnessed a value of 57 for early valves and 18 for newer ones.

Byte 5 seems to be sequential, we have seen valves that are manufactured at the same time with incrementing numbers.  These have been witnessed with all bytes up until this point being identical with the remaining bytes (7-9) changed.  For instance, these valves were all manufactured on 08/19/2019.
1. ```[255, 0, 255][165, 1, 16, 12, 82, 8][0, 128, 128, 31, 18, 75, 154, 185][3, 235]```
2. ```[255, 0, 255][165, 1, 16, 12, 82, 8][0, 128, 128, 31, 18, 76, 39, 119][3, 55]```
3. ```[255, 0, 255][165, 1, 16, 12, 82, 8][0, 128, 128, 31, 18, 79, 209, 34][3, 143]```

So why am I telling you all this.  Well I hope that there are folks out there with puzzle solving skills that can understand what "I am Groot!" means.  Perhaps through observation and a little dic work you might be able to pick up what the valve is laying down.

#### Checksum
 The final two bytes of our Groot message are simply the checksum.  This gives us some assurance that the bytes we have read for the message have all been included.  If the communication chip misses a pulse then this checksum will not be correct.  To calculate a checksum on this protocol you simply add up all the values starting with the first byte of the header to the last byte of the payload to come up with a sum.  Now you see the wisdom of 165 being part of the header since it is calculated into the checksum.  If we included that byte in the preamble it wouldn't be part of our checksum. 
 
 So for ```[255, 0, 255][165, 1, 16, 12, 82, 8][0, 128, 128, 31, 18, 75, 154, 185][3, 235]``` we have ```165 + 1 + 16 + 12 + 82 + 8 + 0 + 128 + 128 + 31 + 18 + 75 + 154 + 185 = 1003```.  
 
 Unfortunately we can only store values up to 255 in a single byte, so there are two bytes to represent the checksum using a technique called big-endian encoding.  The way this works is the first byte is ```1003 / 256``` with the decimal places truncated off.  So we get ```3``` the second byte is ```1003 - (3 x 256) = 235``` if the last two bytes are ```[3,235]``` we have some level of assurance that the message was delivered completely.  As you may have already figured out there are instances where bytes can collide and valid checksums can be calculated out of random bytes so this is not perfect.
 
 The communications here are half-duplex which is just a fancy way of saying that the same two wires are used for transmit and receive messages over RS485.  This means that there will be false positives but reporting these means that we can test and retest.    
   
   
 ## What this software does
 This software sends messages out on the RS485 bus in the hopes that the valve will call us dad.  This means that we get some other message than "I am Groot!"

 ## Installation
 For the message processor to be effective, the only thing on the RS485 adapter should be a single IntelliValve.  If there is any other traffic, then the chatter from those devices may be interpreted for intelligence from the valve.  You must hook up at least one side of the valve to a 24vac with at least 1amp of power.  The green and yellow wires from the IntelliValve should be hooked to your RS485 adapter.
  
 Once you have cloned the repository run ```npm install``` then run ```npm start```.  On first run the application will create a config.json file.  If your RS485 adapter is not recognized or you want to change the web port for the built-in status page you can edit these settings in the config.json located in the root directory of the application.

 Most of the settings for the valve-Grooter are the same as those set for [nodejs-PoolController](https://github.com/tagyoureit/nodejs-poolController#controller-section---changes-to-the-communications-for-the-app).  In fact they use the same message processing and configuration code.
 
 ## Message status
 A simple webpage has been created that will show you the status of the messages that are emitted to the valve.  These begin only after the valve has sent its first groot message to the controller.  To launch the page, open a browser after starting the valve-Grooter server.  Then type ```http://<valve grooter server ip>:8986``` or if you changed the port and/or ip address use the address:port configuration that you assigned to it in the config.json file.
  
 As the messages are sent to IntelliValve the page will refresh with the latest data that has been sent to the valve.  If there are any responses from it please upload your ```equipmentConfig.json``` file in the issues section.  Don't get too excited, the response indicated in the screenshot is "I am Groot!"
 
  ![image](https://user-images.githubusercontent.com/47839015/90079929-29b75880-dcbe-11ea-8ccd-6581ebfcbcdd.png)
 
  ***Here is a quick description of what you will see in the status page***
  
  ***Valve Key:***  This is the unique portion of the Groot message and is the last 6 bytes of the message payload.
  
  ***Method:*** This is the method that we are using to generate the next message we are sending to the valve.
  
  ***Groots:*** Each time the valve says "I am Groot!" we increment this value.
  
  ***Sent:*** This is the total number of messages we have sent to the valve since we started grooting.
  
  ***Last Groot:*** The date and time of the last Groot message.  This can sometimes be several minutes, but if it stops for longer than 10 minutes then I would suggest that your valve stopped responding.
  
  ***Groot Message:***  This is what your valve's Groot message looks like.  When you are done with this exercise your valve should be able to say "I am Groot!" and you should be able to understand it.
  
  ***Last Message:*** This is the last message that the valve-Grooter sent out on the RS485 bus.
  
  ***Last Verified:*** This is the last message that was sent at the time we received an "I am Groot."  valve-Grooter uses this when it detects a message error on the bus.  If it detects an error then it starts over at the last message that was sent prior to receiving a Groot message.  The thinking here is that if the valve is still sending I am groot and we haven't received any responses for the messages we sent then the valve isn't interested in them.
  
  ***Responses:***  If valve-Grooter sees any other traffic on the bus that isn't "I am Groot" it will immediately log the last message that was sent, the message that was received, and the time all this occurred.  The in value is what the valve sent and the out value is what valve-Grooter sent.  Of course ts is the time stamp for the event.
 
 
 # Happy Grooting!  We are all grooting for you!
 
 

