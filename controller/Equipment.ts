import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout } from "timers";
import { Timestamp, ControllerType, utils } from "./Constants";
import { Protocol, Message, Outbound, Inbound } from "./comms/messages/Messages";
import { conn } from "./comms/Comms";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";


interface IEqItemCreator<T> { ctor(data: any, name: string): T; }
interface IEqItemCollection {
    set(data);
    clear();
}
interface IEqItem {
    set(data);
    clear();
    hasChanged: boolean;
    get(bCopy: boolean);
}
class EqItemCollection<T> implements IEqItemCollection {
    protected data: any;
    protected name: string;
    constructor(data: [], name: string) {
        if (typeof data[name] === "undefined") data[name] = [];
        this.data = data[name];
        this.name = name;
    }
    public getItemByIndex(ndx: number, add?: boolean, data?: any): T {
        if (this.data.length > ndx) return this.createItem(this.data[ndx]);
        if (typeof add !== 'undefined' && add)
            return this.add(extend({}, { id: ndx + 1 }, data));
        return this.createItem(extend({}, { id: ndx + 1 }, data));
    }
    public getItemById(id: number | string, add?: boolean, data?: any): T {
        let itm = this.find(elem => elem.id === id && typeof elem.id !== 'undefined');
        if (typeof itm !== 'undefined') return itm;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: id });
        return this.createItem(data || { id: id });
    }
    public removeItemById(id: number | string): T {
        let rem: T = null;
        for (let i = this.data.length - 1; i >= 0; i--)
            if (typeof this.data[i].id !== 'undefined' && this.data[i].id === id) {
                rem = this.data.splice(i, 1);
                return rem;
            }
        return rem;
    }
    public set(data) {
        if (typeof data !== 'undefined') {
            if (Array.isArray(data)) {
                this.clear();
                for (let i = 0; i < data.length; i++) {
                    // We are getting clever here in that we are simply adding the object and the add method
                    // should take care of hooking it all up.
                    this.add(data[i]);
                }
            }
        }
    }
    public removeItemByIndex(ndx: number) {
        this.data.splice(ndx, 1);
    }
    // Finds an item and returns undefined if it doesn't exist.
    public find(f: (value: any, index?: number, obj?: any) => boolean): T {
        let itm = this.data.find(f);
        if (typeof itm !== 'undefined') return this.createItem(itm);
    }
    // This will return a new collection of this type. NOTE: This is a separate object but the data is still attached to the
    // overall configuration.  This meanse that changes made to the objects in the collection will reflect in the configuration.
    // HOWEVER, any of the array manipulation methods like removeItemBy..., add..., or creation methods will not modify the configuration.
    public filter(f: (value: any, index?: any, array?: any[]) => []): EqItemCollection<T> {
        return new EqItemCollection<T>(this.data.filter(f), this.name);
    }
    public toArray() {
        let arr = [];
        if (typeof this.data !== 'undefined') {
            for (let i = 0; i < this.data.length; i++) {
                arr.push(this.createItem(this.data[i]));
            }
        }
        return arr;
    }
    public createItem(data: any): T { return (new EqItem(data) as unknown) as T; }
    public clear() { this.data.length = 0; }
    public get length(): number { return typeof this.data !== 'undefined' ? this.data.length : 0; }
    public set length(val: number) { if (typeof val !== 'undefined' && typeof this.data !== 'undefined') this.data.length = val; }
    public add(obj: any): T { this.data.push(obj); return this.createItem(obj); }
    public get(): any { return this.data; }
    public emitEquipmentChange() { webApp.emitToClients(this.name, this.data); }
    public sortByName() {
        this.sort((a, b) => {
            return a.name > b.name ? 1 : a.name !== b.name ? -1 : 0;
        });
    }
    public sortById() {
        this.sort((a, b) => {
            return a.id > b.id ? 1 : a.id !== b.id ? -1 : 0;
        });
    }
    public sort(fn: (a, b) => number) { this.data.sort(fn); }
}

export class Equipment {
    public _hasChanged: boolean = false;
    public cfgPath: string;
    public data: any;
    protected _lastUpdated: Date;
    protected _isDirty: boolean;
    protected _timerDirty: NodeJS.Timer = null;
    protected _timerChanges: NodeJS.Timeout;
    protected _needsChanges: boolean;
    public valves: IntelliValveCollection;
    constructor() {
        this.cfgPath = path.posix.join(process.cwd(), '/data/equipmentConfig.json');
    }
    public init() {
        let cfg = this.loadConfigFile(this.cfgPath, {});
        let cfgDefault = this.loadConfigFile(path.posix.join(process.cwd(), '/defaultEquipmentConfig.json'), {});
        cfg = extend(true, {}, cfgDefault, cfg);
        this.data = this.onchange(cfg, function () { eq.dirty = true; });
        this.valves = new IntelliValveCollection(this.data, 'valves');
    }
    private loadConfigFile(path: string, def: any) {
        let cfg = def;
        if (fs.existsSync(path)) {
            try {
                cfg = JSON.parse(fs.readFileSync(path, 'utf8') || '{}');
            }
            catch (ex) {
                cfg = def;
            }
        }
        return cfg;
    }
    public async stopAsync() {
        if (this._timerChanges) clearTimeout(this._timerChanges);
        if (this._timerDirty) clearTimeout(this._timerDirty);
    }
    public get dirty(): boolean { return this._isDirty; }
    public set dirty(val) {
        this._isDirty = val;
        if (this._isDirty) {
            if (this._timerDirty !== null) {
                clearTimeout(this._timerDirty);
                this._timerDirty = null;
            }
            if (typeof this._lastUpdated === 'undefined' || this._lastUpdated.getTime() + 4000 < new Date().getTime())
                this.persist();
            else
                this._timerDirty = setTimeout(() => this.persist(), 3000);
        }
    }
    public persist() {
        this._lastUpdated = new Date();
        this.data.lastUpdated = this._lastUpdated.toLocaleString();
        this._isDirty = false;
        
        // Don't overwrite the configuration if we failed during the initialization.
        Promise.resolve()
            .then(() => { fs.writeFileSync(eq.cfgPath, JSON.stringify(eq.data, undefined, 2)); })
            .catch(function (err) { if (err) logger.error('Error writing pool config %s %s', err, eq.cfgPath); });
    }
    public emit() { webApp.emitToClients('valves', this.data); }
    protected onchange = (obj, fn) => {
        const handler = {
            get(target, property, receiver) {
                const val = Reflect.get(target, property, receiver);
                if (typeof val === 'function') return val.bind(receiver);
                if (typeof val === 'object' && val !== null) {
                    if (util.types.isProxy(val)) return val;
                    return new Proxy(val, handler);
                }
                return val;
            },
            set(target, property, value, receiver) {
                if (property !== 'lastUpdated' && Reflect.get(target, property, receiver) !== value) {
                    fn();
                }
                return Reflect.set(target, property, value, receiver);
            },
            deleteProperty(target, property) {
                if (property in target) Reflect.deleteProperty(target, property);
                return true;
            }
        };
        return new Proxy(obj, handler);
    };
}
class EqItem implements IEqItemCreator<EqItem>, IEqItem {
    public dataName: string;
    protected data: any;
    public get hasChanged(): boolean { return eq._hasChanged; }
    public set hasChanged(val: boolean) { if (!eq._hasChanged && val) eq._hasChanged = val; }
    ctor(data, name?: string): EqItem { return new EqItem(data, name); }
    constructor(data, name?: string) {
        if (typeof name !== 'undefined') {
            if (typeof data[name] === 'undefined') data[name] = {};
            this.data = data[name];
            this.dataName = name;
        } else this.data = data;
    }
    public get(bCopy?: boolean): any { return bCopy ? JSON.parse(JSON.stringify(this.data)) : this.data; }
    public clear() {
        for (let prop in this.data) {
            if (Array.isArray(this.data[prop])) this.data[prop].length = 0;
            else this.data[prop] = undefined;
        }
    }
    // This is a tricky endeavor.  If we run into a collection then we need to obliterate the existing data and add in our data.
    public set(data: any) {
        let op = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        for (let i in op) {
            let prop = op[i];
            if (typeof this[prop] === 'function') continue;
            if (typeof data[prop] !== 'undefined') {
                if (this[prop] instanceof EqItemCollection) {
                    ((this[prop] as unknown) as IEqItemCollection).set(data[prop]);
                }
                else if (this[prop] instanceof EqItem)
                    ((this[prop] as unknown) as IEqItem).set(data[prop]);
                else {
                    if (typeof this[prop] === null || typeof data[prop] === null) continue;
                    this[prop] = data[prop];
                }
            }
        }
    } 
    protected setDataVal(name, val, persist?: boolean) {
        if (this.data[name] !== val) {
            // console.log(`Changing equipment: ${this.dataName} ${this.data.id} ${name}:${this.data[name]} --> ${val}`);
            this.data[name] = val;
            if (typeof persist === 'undefined' || persist) this.hasChanged = true;
        }
        else if (typeof persist !== 'undefined' && persist) this.hasChanged = true;
    }
}
export class IntelliValveCollection extends EqItemCollection<IntelliValve> {
    constructor(data: any, name?: string) {
        super(data, name || 'valves');
        // Reset our groots.
        for (let i = 0; i < this.data.length; i++) {
            this.data[i].processing = false;
        }
    }
    public createItem(data: any): IntelliValve { return new IntelliValve(data); }
    public getValveByKey(key: string, add?: boolean, data?: any): IntelliValve {
        let itm = this.find(elem => elem.key === key && typeof elem.key !== 'undefined');
        if (typeof itm !== 'undefined') return itm;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: this.length + 1, key: key });
        return this.createItem(data || { key: key });
    }
    public makeKey(bytes: Array<number>) { return bytes.slice(2).join(':'); }
    public addRepsonses(msg: Inbound) {
        for (let i = 0; i < this.length; i++) {
            let valve = this.getItemByIndex(i);
            if (typeof valve.lastMessage !== 'undefined') {
                valve.responses.push({
                    ts: Timestamp.toISOLocal(msg.timestamp),
                    in: msg.toPkt(),
                    out: valve.lastMessage.toPkt()
                });
            }
        }
    }
    public resetToVerified() {
        for (let i = 0; i < this.length; i++) {
            let valve = this.getItemByIndex(i);
            logger.silly(`Resetting to last verified ${valve.lastVerified.toPkt()}`);
            if (typeof valve.lastVerified !== 'undefined') {
                valve.lastMessage = valve.lastVerified;

            }
        }
    }
}

export class IntelliValve extends EqItem {
    public dataName = 'IntelliValve';
    public _sendTimer: NodeJS.Timeout = null;
    public id: number;
    public get key(): string { return this.data.key || ''; }
    public set key(val: string) { this.data.key = val; }
    public get processing(): boolean { return utils.makeBool(this.data.processing); }
    public set processing(val: boolean) { this.data.processing = val; }
    public get tsLastGroot(): Timestamp { return (typeof this.data.tsLastTimestamp !== 'undefined') ? new Timestamp(new Date(this.data.tsLastTimestamp)) : new Timestamp(); };
    public set tsLastGroot(val: Timestamp) { this.data.tsLastGroot = val.format(); }
    public get totalGroots(): number { return this.data.totalGroots || 0; }
    public set totalGroots(val: number) { this.data.totalGroots = val; }
    public get totalMessages(): number { return this.data.totalMessages || 0; }
    public set totalMessages(val: number) { this.data.totalMessages = val; }
    public get messagesSent(): number { return this.data.messagesSent || 0; }
    public set messagesSent(val: number) { this.data.messagesSent = val; }
    public get grootMessage(): Inbound { return typeof this.data.grootMessage !== 'undefined' ? Inbound.fromPkt(Protocol.IntelliValve, this.data.grootMessage) : undefined; }
    public set grootMessage(val: Inbound) { this.data.grootMessage = val.toPkt(true); }
    public get responses(): any[] { return typeof this.data.responses !== 'undefined' ? this.data.responses : this.data.responses = []; }
    public set responses(val: any[]) { this.data.responses = val; }
    public get lastMessage(): Outbound {
        let out = typeof this.data.lastMessage !== 'undefined' ? Outbound.fromPkt(this.data.lastMessage) : undefined;
        if (typeof out === 'undefined') {
            let groot = this.grootMessage;
            out = Outbound.create({ action: 0, source: 16, dest: 0 });
            out.payload = groot.payload.slice();
        }
        out.calcChecksum();
        return out;
    }
    public set lastMessage(val: Outbound) { this.data.lastMessage = val.toPkt(); }
    public get lastVerified(): Outbound { return typeof this.data.lastVerified !== 'undefined' ? Outbound.fromPkt(this.data.lastVerified) : undefined; }
    public set lastVerified(val: Outbound) { this.data.lastVerified = val.toPkt(); }
    public get method(): string { return this.data.method; }
    public set method(val: string) { this.data.method = val; }
    public get delay(): number { return this.data.delay || 100 }
    public set delay(val: number) {this.data.delay = val }
    public initSendMessages() {
        let self = this;
        // Initialize sending of the messages by starting a timer.
        if (this._sendTimer) {
            clearTimeout(this._sendTimer);
            this._sendTimer = null;
        }
        this.processing = true;
        this._sendTimer = setTimeout(() => { self.sendNextMessage(); }, 10);
    }
    public calcNextLByteTrimMessage(out: Outbound) {
        // In this instance we are testing sending back the groot
        // payload to all addresses and shifting that payload to the left
        // after all sources, destinations, and actions have been exhausted.  The logic here is that
        // for all valves known in the wild the most unique bytes of the groot are to the right.
        let maxSource = 255, minSource = 0;
        let maxDest = 255, minDest = 0;
        let maxAction = 255, minAction = 0;
        if (this.method !== 'lbytetrim') {
            // Create the initial message so that we can start sending them.
            out.source = minSource;
            out.dest = minDest;
            out.action = minAction;
            out.payload = this.grootMessage.payload.slice();
            this.method = 'lbytetrim'
            return;
        }
        if (out.source < minSource) {
            out.source = minSource;
            out.dest = minDest;
            out.action = minAction;
        }
        if (out.dest < minDest) {
            out.dest = minDest;
            out.action = minAction;
        }
        if (out.action < minAction) out.action = minAction;
        if (out.dest === maxDest) {
            out.dest = minDest;
            out.action = minAction;
            // If we are done looking at the lbyte trim lets move
            // on to the command byte method.
            if (out.payload.length === 0) {
                this.calcNextCommandByteMessage(out);
                return;
            }
            out.payload = out.payload.slice(1);
        }
        else if (out.action === maxAction) {
            out.dest = out.dest + 1;
            out.action = minAction;
        }
        else out.action = out.action + 1;
        out.calcChecksum();
        out.retries = 3;
    }
    public calcNextCommandByteMessage(out: Outbound) {
        // In this instance we are testing sending back the groot
        // payload to all addresses and actions while changing the 1st byte of the initial payload.
        // The logic here is that this mirrors much of Pentair's messaging structure in that the first payload byte is 
        // a command identifier.  This is true for all IntelliCenter configuration and panel commands.
        let maxSource = 16, minSource = 16;
        let maxDest = 255, minDest = 0;
        let maxAction = 255, minAction = 0;
        if (this.method !== 'commandbyte') {
            out.source = minSource;
            out.dest = minDest;
            out.action = minAction;
            out.payload = this.grootMessage.payload.slice();
            this.method = 'commandbyte';
        }
        if (out.source < minSource) {
            out.source = minSource;
            out.dest = minDest;
            out.action = minAction;
        }
        if (out.dest < minDest) {
            out.dest = minDest;
            out.action = minAction;
        }
        if (out.action < minAction) out.action = minAction;

        if (out.dest === maxDest) {
            out.dest = minDest;
            out.action = minAction;
            if (out.source === maxSource || out.source === minSource) {
                out.source = minSource;
                //out.payload = out.payload.slice(1); // Trim off the next byte.
                out.payload[0] = out.payload[0] + 1;
                if (out.payload[0] > 255) {
                    out.payload[0] = 0;
                    out.payload[1] = out.payload[1] + 1;
                }
            }
        }
        else if (out.action === maxAction) {
            out.dest = out.dest + 1;
            out.action = minAction;
        }
        else out.action = out.action + 1;
        out.calcChecksum();
        out.retries = 3;
    }
    public calcNextMessage(out: Outbound) {
        switch (this.method) {
            case 'commandbyte':
                this.calcNextCommandByteMessage(out);
                break;
            case 'lbytetrim':
                this.calcNextLByteTrimMessage(out);
                break;
            default:
                this.calcNextLByteTrimMessage(out);
                break;
        }
    }
    public sendNextMessage() {
        let self = this;
        // Information on Groot:
        // 1. The groot message is sent and consistent whenever the valve is in any mode.
        // 2. The groot message is sent and consistent regardless of whether the valve has been reversed or not.
        // 3. The groot message is sent and consistent regardless of whether the valve endpoints are currently being programmed.

        // Already tried and do not work -- Auto Mode:
        // 1. Send the entire payload back with every possible address and action.
        // 2. Send lower 6 bytes back with every destination and action the following sources produce no results.
        //   a. Source 0 to 4 - No response from the valve for all addresses and actions. (This will be abandoned for fixing the source to 16)
        //   b. Source 5 has had all destinations up to 67 and action 174 evaluated.
        // 3. Send lower 6 bytes back with every destination, 16 source, and every action.
        //   a. Destinations 0-255 produce no results.
        // 4. Send lower 5 bytes back with every destination, 16 source, and every action.
        // 5. Send lower 4 bytes back with every destination, 16 source, and every action.
        // 6. Send lower 3 bytes back with every destination, 16 source, and every action.
        // 7. Send lower 2 bytes back with every destination, 16 source, and every action.
        // 8. Send lower 1 bytes back with every destination, 16 source, and every action.
        // 9. Send empty payload with every destination, 16 source, and every action.
        // 10. Send entire payload back on every destination, 16 source and every action where the first payload byte is changed to 0-34.

        let out = this.lastMessage;
        // Reset the message to try again.
        out.tries = 0;
        this.calcNextMessage(out);
        this.totalMessages = this.totalMessages + 1;
        this.lastMessage = out;
        this.delay = this.delay;
        conn.queueSendMessage(this.lastMessage);
        this._sendTimer = setTimeout(() => { eq.emit(); self.sendNextMessage(); }, this.delay);
    }
    public tsLastSend: Timestamp = null;
    public lastPayload: number[] = null;
}
export let eq = new Equipment();