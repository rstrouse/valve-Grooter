import { eq } from "../../Equipment";
import { logger } from "../../../logger/Logger";
import { Inbound } from "../messages/Messages";
import { Timestamp } from "../../Constants";
import { setTimeout } from "timers";
import { config } from "../../../config/Config";
export class IVMessage {
    public static process(msg: Inbound) {
        // Determine if we are groot.
        //logger.info(`${msg.toPkt()}`);
        if (msg) {
            //logger.info(`${msg.toPkt()}`);
            if (IVMessage.isStatus241(msg)) {
                let key = eq.valves.makeKey(msg.payload.slice(0, 8));
                //logger.info(`Got status key: ${key}`);
                // If the valve doesn't exist yet the true flag will create it.
                let valve = eq.valves.getValveByKey(key, true);
                valve.totalStatus++;
                valve.tsLastStatus = new Timestamp();
                if (valve.address === 0) {
                    valve.uuid = msg.payload.slice(0, 8);
                    valve.initGrooting();
                }
                // Let's verify the 241 payload.  If it has changed, log it.
                else if (valve.statusMessage.payload.join(',') !== msg.payload.join(',')) {
                    logger.info('got 241 Change');
                    logger.packet(msg, true);
                    valve.addStatusChange(msg);
                }
                valve.statusMessage = msg;
                if (valve.method === 'command247') logger.packet(msg);
            }
            else if (IVMessage.isGroot(msg)) {
                let key = eq.valves.makeKey(msg.payload);
                //console.log(`${key} valve message`);
                let valve = eq.valves.getValveByKey(key, true);
                valve.tsLastGroot = new Timestamp();
                valve.grootMessage = msg;
                valve.totalGroots++;
                eq.emit();
            }
            else if (IVMessage.is80Ack(msg)) {
                //logger.packet(msg);
                //let valve = eq.valves.getValveByAddress(msg.source);
                //logger.info(`Got 80 Ack ${msg.toPkt()}`);
            }
            else if (IVMessage.isAck(msg, 247)) {
                //logger.packet(msg);

            }
            else {
                eq.valves.addRepsonses(msg);
                if (!config.enableLogging) logger.packet(msg, true);
                logger.info(`We got another message ${msg.toPkt()}`);
            }
            return;
        }
        //if (IVMessage.isGroot(msg)) {
        //    let key = eq.valves.makeKey(msg.payload);
        //    //console.log(`${key} valve message`);
        //    let valve = eq.valves.getValveByKey(key, true);
        //    valve.tsLastGroot = new Timestamp();
        //    //if (!valve.processing) {
        //    //    valve.grootMessage = msg;
        //    //    // Set up to send messages.
        //    //    valve.initSendMessages();
        //    //}
        //    //else if (valve.grootMessage.payload.join(',') !== msg.payload.join(',')) {
        //    //    // Woot! gotcha asshole.
        //    //    eq.valves.addRepsonses(msg);
        //    //    logger.info(`We got another GROOT message ${msg.toShortPacket()}`);
        //    //}
        //    valve.totalGroots++;
        //    valve.lastVerified = valve.lastMessage;
        //}
        //else if (IVMessage.isStatus241(msg)) {
        //    let key = eq.valves.makeKey(msg.payload.slice(0, 8));
        //    let valve = eq.valves.getValveByKey(key, true);
        //    valve.tsLastStatus = new Timestamp();
        //    valve.totalStatus++;

        //    // Check to see if the status has changed
        //    if (typeof valve.statusMessage === 'undefined') {
        //        valve.statusMessage = msg;
        //    }
        //    else if(valve.statusMessage.payload.join(',') !== msg.payload.join(',')) {
        //        logger.info('got 241 Change');
        //        valve.addStatusChange(msg);
        //    }
        //}
        //else if (IVMessage.is80Ack(msg)) {
        //    // Just continue here
        //    logger.info('Got 80 ack');
        //}
        //else {
        //    // Yahoo! we have some other chatter on the bus.
        //    eq.valves.addRepsonses(msg);
        //    logger.packet(msg);
        //    logger.info(`We got another message ${msg.toShortPacket()}`);
        //}
    }
    public static isGroot(msg: Inbound) {
        // Groot messages are as follows.
        // 1. The header is in the form [165,1,16,12,82,8]
        return msg.header.join(',') === '165,1,16,12,82,8';
    }
    public static isStatus241(msg: Inbound) {
        return msg.action === 241;
        //return msg.header.join(',') === '165,1,16,12,241,18';
    }
    public static is80Ack(msg: Inbound) {
        return IVMessage.isAck(msg, 80);
    }
    public static isAck(msg: Inbound, action: number) {
        return msg.action === 1 && msg.payload.length === 1 && msg.payload[0] === action;
    }
}