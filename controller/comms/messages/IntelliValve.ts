import { eq } from "../../Equipment";
import { logger } from "../../../logger/Logger";
import { Inbound } from "../messages/Messages";
import { Timestamp } from "../../Constants";

export class IVMessage {
    public static process(msg: Inbound) {
        // Determine if we are groot.
        
        if (IVMessage.isGroot(msg)) {
            let key = eq.valves.makeKey(msg.payload);
            //console.log(`${key} valve message`);
            let valve = eq.valves.getValveByKey(key, true);
            valve.tsLastGroot = new Timestamp();
            if (!valve.processing) {
                valve.grootMessage = msg;
                // Set up to send messages.
                valve.initSendMessages();
            }
            else if (valve.grootMessage.payload.join(',') !== msg.payload.join(',')) {
                // Woot! gotcha asshole.
                eq.valves.addRepsonses(msg);
                logger.info(`We got another message ${msg.toShortPacket()}`);
            }
            valve.totalGroots++;
            valve.lastVerified = valve.lastMessage;
        }
        else {
            // Yahoo! we have some other chatter on the bus.
            eq.valves.addRepsonses(msg);
            logger.packet(msg);
            logger.info(`We got another message ${msg.toShortPacket()}`);
        }
    }
    public static isGroot(msg: Inbound) {
        // Groot messages are as follows.
        // 1. The header is in the form [165,1,16,12,82,8]
        return msg.header.join(',') === '165,1,16,12,82,8';
    }
}