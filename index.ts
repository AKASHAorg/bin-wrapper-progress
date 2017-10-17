import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

const download = require('download');
const osFilterObj = require('os-filter-obj');
const binCheck = require('bin-check');
const binVersionCheck = require('bin-version-check');

export const events = {
    DOWNLOAD_STARTED: 'DOWNLOAD_STARTED',
    DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
    DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
};
/**
 * port of https://www.npmjs.com/package/bin-wrapper
 */
export default class Wrapper {
    private _progress = new EventEmitter();
    private _opts;
    private _src;
    private _dest;
    private _use;
    private _version;

    constructor(opts?: { strip: number, skipCheck: boolean }) {
        this._opts = opts || { strip: 1, skipCheck: false };
    }

    public src(src?: string, os?: string, arch?: string) {
        if (!arguments.length) {
            return this._src;
        }

        this._src = this._src || [];
        this._src.push({
            url: src,
            os: os,
            arch: arch
        });

        return this;
    };

    public dest(dest?: string) {
        if (!arguments.length) {
            return this._dest;
        }

        this._dest = dest;
        return this;
    };

    public use(bin?: string) {
        if (!arguments.length) {
            return this._use;
        }

        this._use = bin;
        return this;
    };

    public version(range?: string) {
        if (!arguments.length) {
            return this._version;
        }

        this._version = range;
        return this;
    };

    public path() {
        return path.join(this.dest(), this.use());
    };

    public run(cmd, cb) {
        if (typeof cmd === 'function' && !cb) {
            cb = cmd;
            cmd = ['--version'];
        }

        this.findExisting((err) => {
            if (err) {
                cb(err);
                return;
            }

            if (this._opts.skipCheck) {
                cb();
                return;
            }

            return this.runCheck(cmd)
                .then(()=> cb())
                .catch((err)=> cb(err));
        });
    };

    public runCheck(cmd) {
        return binCheck(this.path(), cmd).then((works) => {
            if (!works) {
                throw new Error('The `' + this.path() + '` binary doesn\'t seem to work correctly');
            }

            if (this.version()) {
                return binVersionCheck(this.path(), this.version());
            }

        });
    }

    public findExisting(cb) {
        fs.stat(this.path(), (err) => {
            if (err && err.code === 'ENOENT') {
                this.download(cb);
                return;
            }

            if (err) {
                cb(err);
                return;
            }

            cb();
        });
    }

    public download(cb) {
        const files = osFilterObj(this.src());
        if (!files.length) {
            cb(new Error('No binary found matching your system. It\'s probably not supported.'));
            return;
        }
        this._progress.emit(events.DOWNLOAD_STARTED);
        const destination = this.dest();
        const downloads = [];
        files.forEach((file) => {
            downloads.push(
                download(file.url, destination, { extract: true, strip: this._opts.strip })
                    .on('response', res => {
                        const total = res.headers['content-length'];
                        const progress = {
                            total: parseInt(Array.isArray(total) ? total[0] : total, 10),
                            completed: 0,
                            resource: file.url
                        };
                        this._progress.emit(events.DOWNLOAD_PROGRESS, progress);
                        res.on('data', data => {
                            progress.completed += data.length;
                            this._progress.emit(events.DOWNLOAD_PROGRESS, progress);
                        });
                    })
                    .on('error', error => {
                        this._progress.emit(events.DOWNLOAD_ERROR, error);
                    })
            );
        });

        // this is required for backward compatibility
        return Promise.all(downloads).then(() => {
            cb();
        }).catch((err) => {
            cb(err);
        });
    }

    // use this getter to listen for DOWNLOAD_* events
    public get downloadProgress() {
        return this._progress;
    }
}