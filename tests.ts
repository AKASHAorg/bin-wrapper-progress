import * as path from 'path';
import * as rimraf from 'rimraf';
import { expect } from 'chai';
import Wrapper, { events } from './index';

const binTarget = path.join(__dirname, 'bin');
let wrapperInstance;
const source = (version) => `https://dist.ipfs.io/fs-repo-migrations/v${version}/fs-repo-migrations_v${version}_linux-amd64.tar.gz`;

describe('Wrapper', function () {
    this.timeout(90000);
    before(function () {
        wrapperInstance = new Wrapper().src(source('1.2.2'), 'linux', 'x64')
            .dest(binTarget).use('fs-repo-migrations/fs-repo-migrations');
    });

    beforeEach(function (done) {
        rimraf(binTarget, function () {
            done();
        });
    });

    it('should emit DOWNLOAD_PROGRESS', function (done) {
        wrapperInstance.downloadProgress.on(events.DOWNLOAD_PROGRESS, (stats) => {
            expect(stats).to.have.property('total');
            expect(stats).to.have.property('completed');
            expect(stats).to.have.property('resource');
            if (stats.total === stats.completed) {
                done();
            }
        });
        wrapperInstance.run(['-v'], function (err) {
            expect(err).to.not.exist;
        });
    });

    it('should emit DOWNLOAD_STARTED', function (done) {
        let downloadTriggered = false;
        wrapperInstance.downloadProgress.once(events.DOWNLOAD_STARTED, () => {
            downloadTriggered = true;
        });

        wrapperInstance.downloadProgress.on(events.DOWNLOAD_PROGRESS, (stats) => {
            expect(downloadTriggered).to.be.true;
            expect(stats).to.have.property('total');
            expect(stats).to.have.property('completed');
            expect(stats).to.have.property('resource');
            if (stats.total === stats.completed) {
                done();
            }
        });

        wrapperInstance.run(['-v'], function (err) {
            expect(err).to.not.exist;
        });
    });

    it('should throw error when platform is not supported', function (done) {
        wrapperInstance = new Wrapper().src(source('1.2.2'), 'win32', 'x64')
            .dest(binTarget).use('fs-repo-migrations/fs-repo-migrations');

        wrapperInstance.run(['-v'], function (err) {
            expect(err).to.exist;
            done();
        });
    })

    it('should throw error when source doest not exist', function (done) {
        wrapperInstance = new Wrapper().src(source('1.2.2') + '1231', 'win32', 'x64')
            .dest(binTarget).use('fs-repo-migrations/fs-repo-migrations');

        wrapperInstance.run(['-v'], function (err) {
            expect(err).to.exist;
            done();
        });

        wrapperInstance.downloadProgress.once(events.DOWNLOAD_ERROR, (err) => {
            console.log(err);
            expect(err).to.exist;
        });
    })
});