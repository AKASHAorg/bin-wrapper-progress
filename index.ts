import { EventEmitter } from 'events';

const download = require('download');
const osFilterObj = require('os-filter-obj');

export const BinWrapper = require('bin-wrapper');

export const events = {
    DOWNLOAD_STARTED: 'DOWNLOAD_STARTED',
    DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
    DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
};

export default class Wrapper extends BinWrapper {
    private _progress = new EventEmitter();

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
                download(file.url, destination, { extract: true })
                    .on('response', res => {
                        const progress = { total: res.headers['content-length'], completed: 0, resource: file.url };
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