
import { createReadStream, createWriteStream } from 'fs';
import { pipeline, Readable, Transform, TransformCallback, TransformOptions } from 'stream';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44]);
// IEND Offset for CRC code (4 byte);
const PNG_IEND_OFFSET = 4;

class PngSplitter extends Transform {

    private firstChunk = true;
    private buffer?: Uint8Array;

    private currentStream?: Readable;
    private streamIndex = 0;


    constructor(options?: TransformOptions) {
        super(options);
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
        if (!Buffer.isBuffer(chunk)) {
            chunk = Buffer.from(chunk);
        }
        this.processChunk(chunk, encoding);
        callback();
    }

    private createStream() {
        this.currentStream = new Readable({
            read: () => { },
        });
        this.emit('data', this.currentStream, this.streamIndex);
        this.streamIndex++;
    }

    private processChunk(chunk: Buffer, encoding: BufferEncoding) {

        if (this.firstChunk) {
            this.firstChunk = false;
            if (chunk.indexOf(PNG_SIGNATURE) !== 0) {
                throw new Error('Incorrect stream. PNG signature is not found');
            }
        }

        if (this.buffer?.length && this.buffer.length > 0) {
            chunk = Buffer.concat([this.buffer, chunk]);
        }

        const chunkLength = chunk.length;

        let pos = 0;
        let end = 0;

        while ((pos = chunk.indexOf(PNG_IEND, end, encoding)) !== -1) {
            end = pos + PNG_IEND.length + PNG_IEND_OFFSET;
            if (end > chunkLength) {
                if (!this.buffer) {
                    this.buffer = new Uint8Array;
                }
                chunk.copy(this.buffer, 0, end - PNG_IEND_OFFSET);
                end -= PNG_IEND.length + PNG_IEND_OFFSET;
            } else if (end === chunkLength) {
                end = chunkLength;
            } else {
                end -= PNG_IEND.length;
            }
            this.pushChunk(chunk.slice(0, end), encoding, true);
        }

        if (end < chunkLength) {
            console.log(end, chunkLength, this.streamIndex)
            this.pushChunk(chunk.slice(end, chunkLength), encoding);
        }

        // let offset = chunk.indexOf(PNG_IEND, 0, encoding);

        // if (offset >= 0) {
        //     // console.log(chunkLength, offset + PNG_IEND_OFFSET)
        //     if (offset + PNG_IEND_OFFSET <= chunkLength) {
        //         this.pushChunk(chunk, encoding, true);
        //     }
        // }

        // if (chunk.indexOf(PNG_IEND, chunkLength - PNG_IEND.length) === -1) {
        //     this.pushChunk(chunk, encoding);
        // } else {
        //     this.pushChunk(chunk.slice(0, chunkLength - PNG_IEND.length), encoding);
        //     if (!this.buffer) {
        //         this.buffer = new Uint8Array;
        //     }
        //     chunk.copy(this.buffer, 0, chunkLength - PNG_IEND.length, chunkLength);
        // }

        // this.pushChunk(chunk, encoding);

    }

    private pushChunk(chunk: Buffer, encoding: BufferEncoding, end = false) {

        if (!this.currentStream) {
            this.createStream();
        }

        this.currentStream?.push(chunk, encoding);

        if (end) {
            this.currentStream?.push(null, encoding);
            this.currentStream = undefined;
        }

    }

}


const splitter = new PngSplitter();
splitter.on('data', (stream: Readable, index: number) => {
    // console.log('Stream', index);
    const write = createWriteStream(`./result/file1-${index}.png`, { encoding: 'hex' });
    stream.pipe(write);
})

pipeline(
    createReadStream('./input/data.png'),
    splitter,
    (err) => {
        if (err) {
            console.error('Pipeline failed.', err);
        } else {
            console.log('Pipeline succeeded.');
        }
    }
)

// const read = createReadStream('./download.png');
// const write = createWriteStream('./input/data.png', { encoding: 'hex' });
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);

export default PngSplitter;