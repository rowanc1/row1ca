var argv = require('yargs')
    .option('url', {
        describe: 'Link to webpage',
        demandOption: true
    })
    .option('id', {
        describe: 'Identified for thumbnail',
        demandOption: true
    })
    .option('path', {
        describe: 'Folder for the captured screenshot',
        demandOption: true
    })
    .option('width', {
        alias: 'w',
        describe: 'Width of the browser capture',
        default: 1400
    })
    .option('aspect', {
        alias: 'a',
        describe: 'Aspect ratio',
        default: 0.5
    })
    .option('width_thumbnail', {
        alias: 'wt',
        describe: 'Width of the thumbnail',
        default: 500
    })
    .help('help')
    .argv;


const puppeteer = require('puppeteer');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const path = require('path');

const PATH = argv.path;
const EXT = ".png";
const URL = argv.url;
const ID = argv.id;
const TIMEOUT = 0;
const WIDTH = argv.width;
const HEIGHT = argv.width * argv.aspect;
const WIDTH_THUMBNAIL = argv.width_thumbnail;

const PATH_FULL = path.join(PATH, ID + "_full" + EXT);
const PATH_THUMB = path.join(PATH, ID + EXT);


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

(async() => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
          '--headless',
          '--hide-scrollbars',
          '--mute-audio'
        ]
    });
    const page = await browser.newPage();
    await page.setViewport({width: WIDTH, height: HEIGHT})
    await page.goto(URL, {waitUntil: 'networkidle2'});
    await timeout(TIMEOUT)
    await page.screenshot({path: PATH_FULL});
    console.log("Screenshot created of ", URL);
    browser.close();

    // Make an image thumbnail
    const thumbnail = await imageThumbnail(PATH_FULL, {
        width: WIDTH_THUMBNAIL,
        height: HEIGHT / WIDTH * WIDTH_THUMBNAIL,
    });

    fs.writeFile(PATH_THUMB, thumbnail, (err) => {
        console.log("Thumbnail created.");
    });
})();
