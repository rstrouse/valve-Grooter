﻿import { Timestamp } from "../../Constants";
import { config } from '../../../config/Config';
import { logger } from "../../../logger/Logger";
import { IVMessage } from "./IntelliValve";
export enum Direction {
    In = 'in',
    Out = 'out'
}
export enum Protocol {
    Unknown = 'unknown',
    Broadcast = 'broadcast',
    Pump = 'pump',
    Chlorinator = 'chlorinator',
    IntelliChem = 'intellichem',
    IntelliValve = 'intellivalve',
    Unidentified = 'unidentified'
}
export class Message {
    constructor() { }
    public static commandSourceAddress = 33;
    public static commandDestAddress = 15;
    // Internal Storage
    protected _complete: boolean = false;
    public static headerSubByte: number = 1;
    public static pluginAddress: number = config.getSection('controller', { address: 33 }).address;
    private _id: number = -1;
    // Fields
    private static _messageId: number = 0;
    public static get nextMessageId(): number { return this._messageId < 80000 ? ++this._messageId : this._messageId = 0; }

    public timestamp: Date = new Date();
    public direction: Direction = Direction.In;
    public protocol: Protocol = Protocol.Unknown;
    public padding: number[] = [];
    public preamble: number[] = [];
    public header: number[] = [];
    public payload: number[] = [];
    public term: number[] = [];
    public packetCount: number = 0;
    public get id(): number { return this._id; }
    public set id(val: number) { this._id = val; }
    public isValid: boolean = true;
    // Properties
    public get isComplete(): boolean { return this._complete; }
    public get sub(): number { return this.header.length > 1 ? this.header[1] : -1; }
    public get dest(): number {
        if (this.protocol === Protocol.Chlorinator) {
            return this.header[2] >= 80 ? this.header[2] - 79 : 0;
        }
        if (this.header.length > 2) return this.header[2];
        else return -1;
    }
    public get source(): number {
        if (this.protocol === Protocol.Chlorinator) {
            return this.header[2] >= 80 ? 0 : 1;
            // have to assume incoming packets with header[2] >= 80 (sent to a chlorinator)
            // are from controller (0);
            // likewise, if the destination is 0 (controller) we
            // have to assume it was sent from the 1st chlorinator (1)
            // until we learn otherwise.  
        }
        if (this.header.length > 3) return this.header[3];
        else return -1;
    }
    public get action(): number {
        if (this.protocol === Protocol.Chlorinator) return this.header[3];
        if (this.header.length > 5) return this.header[4];
        else return -1;
    }
    public get datalen(): number { return this.protocol === Protocol.Chlorinator ? this.payload.length : this.header.length > 5 ? this.header[5] : -1; }
    public get chkHi(): number { return this.protocol === Protocol.Chlorinator ? 0 : this.term.length > 0 ? this.term[0] : -1; }
    public get chkLo(): number { return this.protocol === Protocol.Chlorinator ? this.term[0] : this.term[1]; }
    public get checksum(): number {
        var sum = 0;
        for (let i = 0; i < this.header.length; i++) sum += this.header[i];
        for (let i = 0; i < this.payload.length; i++) sum += this.payload[i];
        return sum;
    }

    // Methods
    public toPacket(): number[] {
        const pkt = [];
        pkt.push(...this.padding);
        pkt.push(...this.preamble);
        pkt.push(...this.header);
        pkt.push(...this.payload);
        pkt.push(...this.term);
        return pkt;
    }
    public toShortPacket(): number[] {
        const pkt = [];
        pkt.push(...this.header);
        pkt.push(...this.payload);
        pkt.push(...this.term);
        return pkt;
    }
    public toLog(): string {
        return `{"id":${this.id},"valid":${this.isValid},"dir":"${this.direction}","proto":"${this.protocol}","pkt":[${JSON.stringify(this.padding)},${JSON.stringify(this.preamble)},${JSON.stringify(this.header)},${JSON.stringify(this.payload)},${JSON.stringify(this.term)}],"ts":"${Timestamp.toISOLocal(this.timestamp)}"}`;
    }
    public toPkt(nopadding?: boolean): string {
        return `[${nopadding === true ? '[]' : JSON.stringify(this.padding)}, ${JSON.stringify(this.preamble)}, ${JSON.stringify(this.header)}, ${JSON.stringify(this.payload)}, ${JSON.stringify(this.term)}]`;
    }
    public generateResponse(resp: boolean | Response | Function): ((msgIn: Inbound, msgOut: Outbound) => boolean) | boolean | Response {
        if (typeof resp === 'undefined') { return false; }
        else if (typeof resp === 'function') {
            return resp as (msgIn: Inbound, msgOut: Outbound) => boolean;
        }
        else if (typeof resp === 'boolean') {
            if (!resp) { return false; }
            else {
                return (msgIn, msgOut) => {
                    if (msgIn.protocol !== msgOut.protocol) { return false; }
                    if (typeof msgIn === 'undefined') { return; } // getting here on msg send failure
                    for (let i = 0; i < msgIn.payload.length; i++) {
                        if (i > msgOut.payload.length - 1)
                            return false;
                        if (msgOut.payload[i] !== msgIn.payload[i]) return false;
                        return true;
                    }
                };
            }
        }
        else return resp;
    }
}
export class Inbound extends Message {
    // /usr/bin/socat TCP-LISTEN:9801,fork,reuseaddr FILE:/dev/ttyUSB0,b9600,raw
    // /usr/bin/socat TCP-LISTEN:9801,fork,reuseaddr FILE:/dev/ttyUSB0,b9600,cs8,cstopb=1,parenb=0,raw
    // /usr/bin / socat TCP - LISTEN: 9801,fork,reuseaddr FILE:/dev/ttyUSB0, b9600, cs8, cstopb = 1, parenb = 0, raw
    constructor() {
        super();
        this.direction = Direction.In;
    }
    public static fromPkt(proto: Protocol, str: string): Inbound {
        let arr = JSON.parse(str);
        let inbound: Inbound = new Inbound();
        if (arr.length !== 5) return;
        inbound.payload = arr[3].slice();
        inbound.header = arr[2].slice();
        inbound.preamble = arr[1].slice();
        inbound.padding = arr[0].slice();
        inbound.term = arr[4].slice();
        inbound.protocol = proto;
        return inbound;
    }

    // Factory
    public static replay(obj?: any) {
        let inbound = new Inbound();
        inbound.readHeader(obj.header, 0);
        inbound.readPayload(obj.payload, 0);
        inbound.readChecksum(obj.term, 0);
        inbound.process();
    }
    public responseFor: number[] = [];
    // Private methods
    private isValidChecksum(): boolean {
        if (this.protocol === Protocol.Chlorinator) return this.checksum % 256 === this.chkLo;
        return (this.chkHi * 256) + this.chkLo === this.checksum;
    }
    public toLog() {
        if (this.responseFor.length > 0)
            return `{"id":${this.id},"valid":${this.isValid},"dir":"${this.direction}","proto":"${this.protocol}","for":${JSON.stringify(this.responseFor)},"pkt":[${JSON.stringify(this.padding)},${JSON.stringify(this.preamble)},${JSON.stringify(this.header)},${JSON.stringify(this.payload)},${JSON.stringify(this.term)}],"ts": "${Timestamp.toISOLocal(this.timestamp)}"}`;
        return `{"id":${this.id},"valid":${this.isValid},"dir":"${this.direction}","proto":"${this.protocol}","pkt":[${JSON.stringify(this.padding)},${JSON.stringify(this.preamble)},${JSON.stringify(this.header)},${JSON.stringify(this.payload)},${JSON.stringify(this.term)}],"ts": "${Timestamp.toISOLocal(this.timestamp)}"}`;
    }
    private testChlorHeader(bytes: number[], ndx: number): boolean { return (ndx + 1 < bytes.length && bytes[ndx] === 16 && bytes[ndx + 1] === 2); }
    private testBroadcastHeader(bytes: number[], ndx: number): boolean { return ndx < bytes.length - 3 && bytes[ndx] === 255 && bytes[ndx + 1] === 0 && bytes[ndx + 2] === 255 && bytes[ndx + 3] === 165; }
    private testUnidentifiedHeader(bytes: number[], ndx: number): boolean { return ndx < bytes.length - 3 && bytes[ndx] === 255 && bytes[ndx + 1] === 0 && bytes[ndx + 2] === 255 && bytes[ndx + 3] !== 165; }
    private testChlorTerm(bytes: number[], ndx: number): boolean { return ndx < bytes.length - 2 && bytes[ndx + 1] === 16 && bytes[ndx + 2] === 3; }
    private pushBytes(target: number[], bytes: number[], ndx: number, length: number): number {
        let end = ndx + length;
        while (ndx < bytes.length && ndx < end)
            target.push(bytes[ndx++]);
        return ndx;
    }
    // Methods
    public readPacket(bytes: number[]): number {
        var ndx = this.readHeader(bytes, 0);
        if (this.isValid && this.header.length > 0) ndx = this.readPayload(bytes, ndx);
        if (this.isValid && this.header.length > 0) ndx = this.readChecksum(bytes, ndx);
        return ndx;
    }
    public mergeBytes(bytes) {
        var ndx = 0;
        if (this.header.length === 0) ndx = this.readHeader(bytes, ndx);
        if (this.isValid && this.header.length > 0) ndx = this.readPayload(bytes, ndx);
        if (this.isValid && this.header.length > 0) ndx = this.readChecksum(bytes, ndx);
        return ndx;
    }
    public readHeader(bytes: number[], ndx: number): number {
        // start over to include the padding bytes.
        let ndxStart = ndx;
        while (ndx < bytes.length) {
            if (this.testChlorHeader(bytes, ndx)) {
                this.protocol = Protocol.Chlorinator;
                break;
            }
            if (this.testBroadcastHeader(bytes, ndx)) {
                this.protocol = Protocol.Broadcast;
                break;
            }
            else if (this.testUnidentifiedHeader(bytes, ndx)) {
                this.protocol = Protocol.Unidentified;
                break;
            }
            this.padding.push(bytes[ndx++]);
        }
        let ndxHeader = ndx;
        switch (this.protocol) {
            case Protocol.Pump:
            case Protocol.IntelliChem:
            case Protocol.IntelliValve:
            case Protocol.Broadcast:
            case Protocol.Unidentified:
                ndx = this.pushBytes(this.preamble, bytes, ndx, 3);
                ndx = this.pushBytes(this.header, bytes, ndx, 6);
                if (this.header.length < 6) {
                    // We actually don't have a complete header yet so just return.
                    // we will pick it up next go around.
                    logger.verbose(`We have an incoming message but the serial port hasn't given a complete header. [${this.padding}][${this.preamble}][${this.header}]`);
                    this.preamble = [];
                    this.header = [];
                    return ndxHeader;
                }

                if (this.source >= 96 && this.source <= 111) this.protocol = Protocol.Pump;
                else if (this.dest >= 96 && this.dest <= 111) this.protocol = Protocol.Pump;
                else if (this.dest >= 144 && this.dest <= 158) this.protocol = Protocol.IntelliChem;
                else if (this.source >= 144 && this.source <= 158) this.protocol = Protocol.IntelliChem;
                else if (this.source == 12 || this.dest == 12) this.protocol = Protocol.IntelliValve;
                if (this.datalen > 75) {
                    this.isValid = false;
                    logger.verbose(`Protocol length ${this.datalen} exceeded 75bytes for ${this.protocol} message. Message marked as invalid ${this.header}`);
                }
                break;
            case Protocol.Chlorinator:
                // RKS: 06-06-20 We occasionally get messages where the 16, 2 is interrupted.  The message below
                // has an IntelliValve broadcast embedded within as well as a chlorinator status request. So
                // in the instance below we have two messages being tossed because something on the bus interrupted
                // the chlorinator.  The first 240 byte does not belong to the chlorinator nor does it belong to
                // the IntelliValve
                //[][16, 2, 240][255, 0, 255, 165, 1, 16, 12, 82, 8, 0, 128, 216, 128, 57, 64, 25, 166, 4, 44, 16, 2, 80, 17, 0][115, 16, 3]
                //[][16, 2, 80, 17][0][115, 16, 3]
                ndx = this.pushBytes(this.header, bytes, ndx, 4);
                if (this.header.length < 4) {
                    // We actually don't have a complete header yet so just return.
                    // we will pick it up next go around.
                    logger.verbose(`We have an incoming chlorinator message but the serial port hasn't given a complete header. [${this.padding}][${this.preamble}][${this.header}]`);
                    this.preamble = [];
                    this.header = [];
                    return ndxHeader;
                }
                break;
            default:
                // We didn't get a message signature. don't do anything with it.
                //logger.verbose(`Message Signature could not be found in ${bytes}. Resetting.`);
                ndx = ndxStart;
                if (bytes.length > 24) {
                    // 255, 255, 255, 0, 255
                    ndx = bytes.length - 3;
                    let arr = bytes.slice(0, ndx);
                    // Remove all but the last 4 bytes.  This will result in nothing anyway.
                    logger.silly(`Tossed Inbound Bytes ${arr} due to an unrecoverable collision.`);
                }
                this.padding = [];
                break;
        }
        return ndx;
    }
    public readPayload(bytes: number[], ndx: number): number {
        //if (!this.isValid) return bytes.length;
        if (!this.isValid) return ndx;
        switch (this.protocol) {
            case Protocol.Broadcast:
            case Protocol.Pump:
            case Protocol.IntelliChem:
            case Protocol.IntelliValve:
            case Protocol.Unidentified:
                if (this.datalen - this.payload.length <= 0) return ndx; // We don't need any more payload.
                ndx = this.pushBytes(this.payload, bytes, ndx, this.datalen - this.payload.length);
                break;
            case Protocol.Chlorinator:
                // We need to deal with chlorinator packets where the terminator is actually split meaning only the first byte or
                // two of the total payload is provided for the term.  We need at least 3 bytes to make this determination.
                while (ndx + 3 <= bytes.length && !this.testChlorTerm(bytes, ndx)) {
                    this.payload.push(bytes[ndx++]);
                    if (this.payload.length > 25) {
                        this.isValid = false; // We have a runaway packet.  Some collision occurred so lets preserve future packets.
                        logger.verbose(`Chlorinator message marked as invalid after not finding 16,3 in payload after ${this.payload.length} bytes`);
                        break;
                    }
                }
                break;
        }
        return ndx;
    }
    public readChecksum(bytes: number[], ndx: number): number {
        if (!this.isValid) return bytes.length;
        if (ndx >= bytes.length) return ndx;
        switch (this.protocol) {
            case Protocol.Broadcast:
            case Protocol.Pump:
            case Protocol.IntelliValve:
            case Protocol.IntelliChem:
            case Protocol.Unidentified:
                // If we don't have enough bytes to make the terminator then continue on and
                // hope we get them on the next go around.
                if (this.payload.length >= this.datalen && ndx + 2 <= bytes.length) {
                    this._complete = true;
                    ndx = this.pushBytes(this.term, bytes, ndx, 2);
                    this.isValid = this.isValidChecksum();
                }
                break;
            case Protocol.Chlorinator:
                if (ndx + 3 <= bytes.length && this.testChlorTerm(bytes, ndx)) {
                    this._complete = true;
                    ndx = this.pushBytes(this.term, bytes, ndx, 3);
                    this.isValid = this.isValidChecksum();
                }
                break;
        }
        return ndx;
    }
    public extractPayloadString(start: number, length: number) {
        var s = '';
        for (var i = start; i < this.payload.length && i < start + length; i++) {
            if (this.payload[i] <= 0) break;
            s += String.fromCharCode(this.payload[i]);
        }
        return s;
    }
    public extractPayloadInt(ndx: number, def?: number) {
        return ndx + 1 < this.payload.length ? (this.payload[ndx + 1] * 256) + this.payload[ndx] : def;
    }
    public extractPayloadByte(ndx: number, def?: number) {
        return ndx < this.payload.length ? this.payload[ndx] : def;
    }
    private processBroadcast(): void {
    }
    public process() {
        IVMessage.process(this);
    }
}
export class Outbound extends Message {
    constructor(proto: Protocol, source: number, dest: number, action: number, payload: number[], retries?: number, response?: Response | boolean | Function) {
        super();
        this.id = Message.nextMessageId;
        this.protocol = proto;
        this.direction = Direction.Out;
        this.retries = retries || 0;
        this.preamble.length = 0;
        this.header.length = 0;
        this.term.length = 0;
        this.payload.length = 0;
        if (proto === Protocol.Chlorinator) {
            this.header.push.apply(this.header, [16, 2, 0, 0]);
            this.term.push.apply(this.term, [0, 16, 3]);
        }
        else if (proto === Protocol.Broadcast) {
            this.preamble.push.apply(this.preamble, [255, 0, 255]);
            this.header.push.apply(this.header, [165, Message.headerSubByte, 15, Message.pluginAddress, 0, 0]);
            this.term.push.apply(this.term, [0, 0]);
        }
        else if (proto === Protocol.Pump || proto === Protocol.IntelliValve || proto === Protocol.IntelliChem) {
            this.preamble.push.apply(this.preamble, [255, 0, 255]);
            this.header.push.apply(this.header, [165, 0, 15, Message.pluginAddress, 0, 0]);
            this.term.push.apply(this.term, [0, 0]);
        }
        this.source = source;
        this.dest = dest;
        this.action = action;
        this.payload.push.apply(this.payload, payload);
        this.calcChecksum();
        this.response = this.generateResponse(response);
    }
    // Factory
    public static create(obj?: any) {
        let out = new Outbound(obj.protocol || Protocol.Broadcast,
            typeof obj.source !== 'undefined' ? obj.source : Message.commandSourceAddress || Message.pluginAddress,
            typeof obj.dest !== 'undefined' ? obj.dest : Message.commandDestAddress || 16,
            obj.action || 0, obj.payload || [], obj.retries || 0, obj.response || false);
        out.onComplete = obj.onComplete;
        out.onResponseProcessed = obj.onResponseProcessed;
        out.timeout = obj.timeout;
        return out;
    }
    public static createMessage(action: number, payload: number[], retries?: number, response?: Response | boolean | Function): Outbound {
        return new Outbound(Protocol.Broadcast, Message.commandSourceAddress || Message.pluginAddress, Message.commandDestAddress || 16, action, payload, retries, response);
    }
    public static fromPkt(str: string) {
        let arr = JSON.parse(str);
        let out: Outbound = new Outbound(Protocol.Broadcast, 16, 0, 0, []);
        if (arr.length !== 5) return;
        out.payload = arr[3].slice();
        out.header = arr[2].slice();
        out.preamble = arr[1].slice();
        out.padding = arr[0].slice();
        out.term = arr[4].slice();
        return out;
    }
    // Fields
    public retries: number = 0;
    public tries: number = 0;
    public timeout: number = 1000;
    public response: ((msgIn: Inbound, msgOut: Outbound) => boolean) | Response | boolean;
    public failed: boolean = false;
    public onComplete: (error: Error, msg: Inbound) => void;
    public onResponseProcessed: () => void;
    // Properties
    public get sub() { return super.sub; }
    public get dest() { return super.dest; }
    public get source() { return super.source; }
    public get action() { return super.action; }
    public get datalen() { return super.datalen; }
    public get chkHi() { return super.chkHi; }
    public get chkLo() { return super.chkLo; }
    public set sub(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[1] = val; }
    public set dest(val: number) { this.protocol !== Protocol.Chlorinator ? this.header[2] = val : this.header[2] = val + 79; }
    public set source(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[3] = val; }
    public set action(val: number) { (this.protocol !== Protocol.Chlorinator) ? this.header[4] = val : this.header[3] = val; }
    public set datalen(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[5] = val; }
    public set chkHi(val: number) { if (this.protocol !== Protocol.Chlorinator) this.term[0] = val; }
    public set chkLo(val: number) { if (this.protocol !== Protocol.Chlorinator) this.term[1] = val; else this.term[0] = val; }
    public get requiresResponse(): boolean {
        if (typeof this.response === 'undefined' || (typeof this.response === 'boolean' && !this.response)) return false;
        if (this.response instanceof Response || typeof this.response === 'function') { return true; }
        return false;
    }
    public get remainingTries(): number { return this.retries - this.tries + 1; } // Always allow 1 try.
    // Methods
    public calcChecksum() {
        this.datalen = this.payload.length;
        let sum: number = this.checksum;
        switch (this.protocol) {
            case Protocol.Pump:
            case Protocol.Broadcast:
            case Protocol.IntelliValve:
            case Protocol.Unidentified:
            case Protocol.IntelliChem:
                this.chkHi = Math.floor(sum / 256);
                this.chkLo = (sum - (super.chkHi * 256));
                break;
            case Protocol.Chlorinator:
                this.term[0] = sum;
                break;
        }
    }

    public setPayloadByte(ndx: number, value: number, def?: number) {
        if (typeof value === 'undefined' || isNaN(value)) value = def;
        if (ndx < this.payload.length) this.payload[ndx] = value;
        return this;
    }
    public appendPayloadByte(value: number, def?: number) {
        if (typeof value === 'undefined' || isNaN(value)) value = def;
        this.payload.push(value);
        return this;
    }
    public appendPayloadBytes(value: number, len: number) {
        for (let i = 0; i < len; i++) this.payload.push(value);
        return this;
    }
    public setPayloadBytes(value: number, len: number) {
        for (let i = 0; i < len; i++) {
            if (i < this.payload.length) this.payload[i] = value;
        }
        return this;
    }
    public insertPayloadBytes(ndx: number, value: number, len: number) {
        let buf = [];
        for (let i = 0; i < len; i++) {
            buf.push(value);
        }
        this.payload.splice(ndx, 0, ...buf);
        return this;
    }
    public setPayloadInt(ndx: number, value: number, def?: number) {
        if (typeof value === 'undefined' || isNaN(value)) value = def;
        let b1 = Math.floor(value / 256);
        let b0 = value - (b1 * 256);
        if (ndx < this.payload.length) this.payload[ndx] = b0;
        if (ndx + 1 < this.payload.length) this.payload[ndx + 1] = b1;
        return this;
    }
    public appendPayloadInt(value: number, def?: number) {
        if (typeof value === 'undefined' || isNaN(value)) value = def;
        let b1 = Math.floor(value / 256);
        let b0 = value - (b1 * 256);
        this.payload.push(b0);
        this.payload.push(b1);
        return this;
    }
    public insertPayloadInt(ndx: number, value: number, def?: number) {
        if (typeof value === 'undefined' || isNaN(value)) value = def;
        let b1 = Math.floor(value / 256);
        let b0 = (value - b1) * 256;
        this.payload.splice(ndx, 0, b0, b1);
        return this;
    }
    public setPayloadString(s: string, len?: number, def?: string) {
        if (typeof s === 'undefined') s = def;
        for (var i = 0; i < s.length; i++) {
            if (i < this.payload.length) this.payload[i] = s.charCodeAt(i);
        }
        if (typeof (len) !== 'undefined') {
            for (var j = i; j < len; j++)
                if (i < this.payload.length) this.payload[i] = 0;
        }
        return this;
    }
    public appendPayloadString(s: string, len?: number, def?: string) {
        if (typeof s === 'undefined') s = def;
        for (var i = 0; i < s.length; i++) {
            if (typeof (len) !== 'undefined' && i >= len) break;
            this.payload.push(s.charCodeAt(i));
        }
        if (typeof (len) !== 'undefined') {
            for (var j = i; j < len; j++) this.payload.push(0);
        }
        return this;
    }
    public insertPayloadString(start: number, s: string, len?: number, def?: string) {
        if (typeof s === 'undefined') s = def;
        let l = typeof len === 'undefined' ? s.length : len;
        let buf = [];
        for (let i = 0; i < l; l++) {
            if (i < l) buf.push(s.charCodeAt(i));
            else buf.push(i);
        }
        this.payload.splice(start, 0, ...buf);
        return this;
    }
    public toPacket(): number[] {
        var pkt = [];
        this.calcChecksum();
        pkt.push.apply(pkt, this.padding);
        pkt.push.apply(pkt, this.preamble);
        pkt.push.apply(pkt, this.header);
        pkt.push.apply(pkt, this.payload);
        pkt.push.apply(pkt, this.term);
        return pkt;
    }
}
export class Ack extends Outbound {
    constructor(byte: number) {
        super(Protocol.Broadcast, Message.pluginAddress, 15, 1, [byte]);
    }
}
export class Response extends Message {
    public message: Inbound;
    constructor(proto: Protocol, source: number, dest: number, action?: number, payload?: number[], ack?: number, callback?: (err, msg?: Outbound) => void) {
        super();
        this.protocol = proto;
        this.direction = Direction.In;
        if (proto === Protocol.Chlorinator) {
            this.header.push.apply(this.header, [16, 2, 0, 0]);
            this.term.push.apply(this.term, [0, 16, 3]);
        }
        else if (proto === Protocol.Broadcast) {
            this.preamble.push.apply(this.preamble, [255, 0, 255]);
            this.header.push.apply(this.header, [165, Message.headerSubByte, 0, 0, 0, 0]);
            this.term.push.apply(this.term, [0, 0]);
        }
        else if (proto === Protocol.Pump) {
            this.preamble.push.apply(this.preamble, [255, 0, 255]);
            this.header.push.apply(this.header, [165, 0, 0, 0, 0, 0]);
            this.term.push.apply(this.term, [0, 0]);
        }
        this.source = source;
        this.dest = dest;
        this.action = action;
        if (typeof payload !== 'undefined' && payload.length > 0) this.payload.push(...payload);
        if (typeof ack !== 'undefined' && ack !== null) this.ack = new Ack(ack);
        this.calcChecksum();
        this.callback = callback;
    }
    public static create(obj?: any) {
        let res = new Response(obj.protocol || Protocol.Broadcast,
            obj.source || Message.pluginAddress, obj.dest || 16, obj.action || 0, obj.payload || [], obj.ack, obj.callback);
        return res;
    }

    // Factory
    // RKS: 06-24-20 Deprecated as this is no longer used.
    //public static createResponse(action: number, payload: number[]): Response {
    //    return new Response(Protocol.Broadcast, 15, Message.pluginAddress, action, payload);
    //}
    // RKS: 06-24-20 Deprecated as this is no longer used.
    //public static createChlorinatorResponse(action: number, callback?: (err, msg) => void) {
    //    // source, payload, ack are` not used
    //    return new Response(Protocol.Chlorinator, 80, 0, action, undefined, undefined, callback);
    //}
    // RKS: 06-24-20 Deprecated as this is no longer used.
    //public static createPumpResponse(action: number, pumpAddress: number, payload?: number[], callback?: (err, msg?: Outbound) => void) {
    //    return new Response(Protocol.Pump, pumpAddress, 0, action, payload, undefined, callback);
    //}
    // Fields
    public ack: Ack;
    public callback: (err, msg?: Outbound) => void;

    // Properties
    public get sub() { return super.sub; }
    public get dest() { return super.dest; }
    public get source() { return super.source; }
    public get action() { return super.action; }
    public get datalen() { return super.datalen; }
    // todo: Set outbound Chlor values
    public set sub(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[1] = val; }
    public set dest(val: number) { this.protocol !== Protocol.Chlorinator ? this.header[2] = val : this.header[2] = val; }
    public set source(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[3] = val; }
    public set action(val: number) { (this.protocol !== Protocol.Chlorinator) ? this.header[4] = val : this.header[3] = val; }
    public set datalen(val: number) { if (this.protocol !== Protocol.Chlorinator) this.header[5] = val; }
    public set chkHi(val: number) { if (this.protocol !== Protocol.Chlorinator) this.term[0] = val; }
    public set chkLo(val: number) { if (this.protocol !== Protocol.Chlorinator) this.term[1] = val; else this.term[0] = val; }
    public get needsACK() { return (this.protocol !== Protocol.Unknown || typeof this.ack !== 'undefined'); }
    // RSG: Same as outbound... maybe move this to Message class?
    public calcChecksum() {
        this.datalen = this.payload.length;
        let sum: number = this.checksum;
        switch (this.protocol) {
            case Protocol.IntelliChem:
            case Protocol.IntelliValve:
            case Protocol.Pump:
            case Protocol.Broadcast:
                this.chkHi = Math.floor(sum / 256);
                this.chkLo = (sum - (super.chkHi * 256));
                break;
            case Protocol.Chlorinator:
                this.term[0] = sum;
                break;
        }
    }
    // Methods
    public isResponse(msgIn: Inbound, msgOut?: Outbound): boolean {
        if (typeof this.action !== 'undefined' && this.action !== null && msgIn.action !== this.action)
            return false;
        // intellicenter packets
        if (this.dest >= 0 && msgIn.dest !== this.dest) return false;
        for (let i = 0; i < this.payload.length; i++) {
            if (i > msgIn.payload.length - 1)
                return false;
            //console.log({ msg: 'Checking response', p1: msgIn.payload[i], pd: this.payload[i] });
            if (msgIn.payload[i] !== this.payload[i]) return false;
        }
        if (typeof msgOut !== 'undefined') {
            msgIn.responseFor.push(msgOut.id);
        }
        return true;
    }
}