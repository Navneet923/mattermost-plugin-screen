import {Client4} from 'mattermost-redux/client';
import request from 'superagent';

import ScreenRecorder from './recorder.js';

export default class Client {
    constructor() {
        this.recorder = new ScreenRecorder();
        this.timerId = null;
        this._onUpdate = null;
        this._onStop = null;
        this.recording = null;
    }

    async startRecording() {
        await this.recorder.start();

        this.timerId = setInterval(() => {
            if (this._onUpdate && this.recorder.startTime) {
                this._onUpdate(new Date().getTime() - this.recorder.startTime);
            }
        }, 200);

        this.recorder.on('stop', () => {
            if (this._onStop) {
                if (this.timerId) {
                    clearInterval(this.timerId);
                }
                this._onStop();
                this._reset();
            }
        });

        this.recorder.on('data', (data) => {
            this.recording = data;
            if (this._onData) {
                this._onData(data);
            }
        });
    }

    _reset() {
        if (this.timerId) {
            clearInterval(this.timerId);
        }
        this.timerId = null;
        this.recording = null;
    }

    stopRecording() {
        this._reset();
        this.recorder.stop(false);
    }

    cancelRecording() {
        this._reset();
        this.recorder.stop(true);
    }

    uploadRecording(channelId, userId, rootId) {
        if (!channelId) {
            return Promise.reject(new Error('channelId required'));
        }

        const filename = 'screenrec.mp4';
        return request.
            post(Client4.getFilesRoute()).
            set(Client4.getOptions({method: 'post'}).headers).
            attach('files', this.recording, filename).
            field('channel_id', channelId).
            accept('application/json').then((res) => {
                const fileId = res.body.file_infos[0].id;
                return request.post(Client4.getPostsRoute()).
                    set(Client4.getOptions({method: 'post'}).headers).
                    send({
                        channel_id: channelId,
                        message: '',
                        root_id: rootId,
                        file_ids: [fileId],
                    }).accept('application/json');
            });
    }

    on(type, cb) {
        if (type === 'update') {
            this._onUpdate = cb;
        } else if (type === 'stop') {
            this._onStop = cb;
        } else if (type === 'data') {
            this._onData = cb;
        }
    }
}
