﻿import { EventEmitter } from 'events';
export class Timestamp {
    private _dt: Date;
    public emitter: EventEmitter;
    constructor(dt?: Date) {
        this._dt = dt || new Date();
        this.emitter = new EventEmitter();
    }
    private _isUpdating: boolean = false;
    public set isUpdating(val: boolean) { this._isUpdating = val; }
    public get isUpdating(): boolean { return this._isUpdating; }
    public get hours(): number { return this._dt.getHours(); }
    public set hours(val: number) {
        if (this.hours !== val) {
            this._dt.setHours(val);
            this.emitter.emit('change');
        }
    }
    public get minutes(): number { return this._dt.getMinutes(); }
    public set minutes(val: number) {
        if (this.minutes !== val) {
            this._dt.setMinutes(val);
            this.emitter.emit('change');
        }
    }
    public get seconds(): number { return this._dt.getSeconds(); }
    public set seconds(val: number) {
        if (this.seconds !== val) {
            this._dt.setSeconds(val);
            // No need to emit this change as Intellicenter only
            // reports to the minute.
            //this.emitter.emit('change');
        }
    }
    public get milliseconds(): number { return this._dt.getMilliseconds(); }
    public set milliseconds(val: number) { this._dt.setMilliseconds(val); }
    public get fullYear(): number { return this._dt.getFullYear(); }
    public set fullYear(val: number) { this._dt.setFullYear(val); }
    public get year(): number { return this._dt.getFullYear(); }
    public set year(val: number) {
        let y = val < 100 ? (Math.floor(this._dt.getFullYear() / 100) * 100) + val : val;
        if (y !== this.year) {
            this._dt.setFullYear(y);
            this.emitter.emit('change');
        }
    }
    public get month(): number { return this._dt.getMonth() + 1; }
    public set month(val: number) {
        if (this.month !== val) {
            this._dt.setMonth(val - 1);
            this.emitter.emit('change');
        }
    }
    public get date(): number { return this._dt.getDate(); }
    public set date(val: number) {
        if (this.date !== val) {
            this._dt.setDate(val);
            this.emitter.emit('change');
        }
    }
    public get dayOfWeek(): number {
        // for IntelliTouch set date/time
        if (this._dt.getUTCDay() === 0)
            return 0;
        else
            return Math.pow(2, this._dt.getUTCDay() - 1);
    }
    public getTime() { return this._dt.getTime(); }
    public format(): string { return Timestamp.toISOLocal(this._dt); }
    public static toISOLocal(dt): string {
        let tzo = dt.getTimezoneOffset();
        var pad = function (n) {
            var t = Math.floor(Math.abs(n));
            return (t < 10 ? '0' : '') + t;
        };
        return new Date(dt.getTime() - (tzo * 60000)).toISOString().slice(0, -1) + (tzo > 0 ? '-' : '+') + pad(tzo / 60) + pad(tzo % 60)
    }
    public setTimeFromSystemClock() {
        this._dt = new Date();
        this.emitter.emit('change');
    }
    public calcTZOffset(): { tzOffset: number, adjustDST: boolean } {
        let obj = { tzOffset: 0, adjustDST: false };
        let dateJan = new Date(this._dt.getFullYear(), 0, 1, 2);
        let dateJul = new Date(this._dt.getFullYear(), 6, 1, 2);
        obj.tzOffset = dateJan.getTimezoneOffset() / 60 * -1;
        obj.adjustDST = dateJan.getTimezoneOffset() - dateJul.getTimezoneOffset() > 0;
        return obj;
    }
}
export enum ControllerType {
    IntelliCenter = 'intellicenter',
    IntelliTouch = 'intellitouch',
    IntelliCom = 'intellicom',
    EasyTouch = 'easytouch',
    Unknown = 'unknown',
    Virtual = 'virtual'
}
export class Utils {
    public makeBool(val) {
        if (typeof (val) === 'boolean') return val;
        if (typeof (val) === 'undefined') return false;
        if (typeof (val) === 'number') return val >= 1;
        if (typeof (val) === 'string') {
            if (val === '' || typeof val === 'undefined') return false;
            switch (val.toLowerCase().trim()) {
                case 'on':
                case 'true':
                case 'yes':
                case 'y':
                    return true;
                case 'off':
                case 'false':
                case 'no':
                case 'n':
                    return false;
            }
            if (!isNaN(parseInt(val, 10))) return parseInt(val, 10) >= 1;
        }
        return false;
    }
}

export const utils = new Utils();