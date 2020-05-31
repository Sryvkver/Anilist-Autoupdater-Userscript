// ==UserScript==
// @name         Auto Update anilist
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Currently supports Proxer, Crunchyroll
// @author       You
// @match        https://proxer.me/watch/*/*/*
// @match        https://www.crunchyroll.com/*/*
// @match        https://stream.proxer.me/*
// @match        https://www.wakanim.tv/de/v2/catalogue/episode/*
// @require      https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/a4a49b47ecfb1d8fcd27049cc0e8114d05522a0f/gm_config.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// ==/UserScript==
'use strict';

//#region TODO

/**
 * ADD - Manga support
 * ADD - Add some new websites
 * ADD - Add all providers from proxer
 * ADD - Add auto detection of supported sites instead of the switch statement - Yea needs some improvement but poc works so meh
 * FIX - Refactor some things and clean the code up
 */

/** WEBSITES TO ADD
 * 9Anime
 * Aniplus
 */

//#endregion

//#region Constants
const ProviderType = {
    ANIME: 'ANIME',
    MANGA: 'MANGA'
}

const IframeInjectionListeners = {
    'Time': 'tmp_time',
    'Duration': 'tmp_duration'
}

const MediaType = {
    ANIME: 'ANIME',
    MANGA: 'MANGA'
}

const MediaStatus = {
    CURRENT: 'CURRENT',
    COMPLETED: 'COMPLETED',
    REPEATING: 'REPEATING'
}

const utils = {
    debug: function(){
        if(GM_config.get('Debug_log')){
            console.groupCollapsed(`%c[Anilist Updater]`, 'color: #a9a9a9; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
            console.trace(); // hidden in collapsed group
            console.groupEnd();
            //console.trace(`%c[Anilist Updater]`, 'color: #ffbcbc; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
        }
    },
    log: function(){
        console.groupCollapsed(`%c[Anilist Updater]`, 'color: #ffbcbc; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
        console.trace(); // hidden in collapsed group
        console.groupEnd();
        //if(GM_config.get('Debug_log')){
            //console.trace(`%c[Anilist Updater]`, 'color: #ffbcbc; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
        //}
    },
    error: function(){
        console.groupCollapsed(`%c[Anilist Updater]`, 'color: #f56969; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
        console.trace(); // hidden in collapsed group
        console.groupEnd();
        //if(GM_config.get('Debug_log')){
            //console.error(`%c[Anilist Updater]`, 'color: #ffbcbc; font-weight: bold; font-size: 1rem; background: #363636', ...arguments);
        //}
    }
};
//#endregion

//#region Classes

class Provider {
    constructor(){
        this.__HREF__ = [''];
    }
}

class AnimeProvider extends Provider {
    constructor(storageId) {
        super();
        this.__TYPE__ = ProviderType.ANIME;
        this.storageId = storageId;
        this.anime_list = JSON.parse(GM_getValue(this.storageId, '{}'));
    }

    getName() {
        throw new Error('You have to implement the method getName!');
    }

    getEpisode() {
        throw new Error('You have to implement the method getEpisode!');
    }

    getCurrentTime() {
        throw new Error('You have to implement the method getCurrentTime!');
    }

    getDuration() {
        throw new Error('You have to implement the method getDuration!');
    }

    getId(name) {
        return this.anime_list[name];
    }

    hasId(name) {
        return !!this.anime_list[name]
    }

    addId(name, id) {
        this.anime_list[name] = id;
        GM_setValue(this.storageId, JSON.stringify(this.anime_list));
    }

    waitTillIFrameCheckReady(check, timeout=5000){
        return new Promise(async (res, rej) => {
            let time = 0;
            while(GM_getValue(check, -5) != -5 && time < timeout){
                await wait(5);
                time += 5;
            }
            GM_setValue(check, -9); //Set some number to clear all other awaits out;
            GM_setValue(check, -99); //Set number to -99 to fail this test, in case of when another script is running
            res();
        })
    }
}

class MangaProvider extends Provider {
    constructor(storageId) {
        super();
        this.__TYPE__ = ProviderType.MANGA;
        this.storageId = storageId;
        this.manga_list = JSON.parse(GM_getValue(this.storageId, '{}'));
    }

    getName() {
        throw new Error('You have to implement the method getName!');
    }

    getVolume() {
        throw new Error('You have to implement the method getEpisode!');
    }

    getId(name) {
        return this.manga_list[name];
    }

    hasId(name) {
        return !!this.manga_list[name]
    }

    addId(name, id) {
        this.manga_list[name] = id;
        GM_setValue(this.storageId, JSON.stringify(this.manga_list));
    }
}

class ProviderIframe extends Provider {
    constructor(){
        super();
    }

    getCurrentTimeIframe() {
        throw new Error('You have to implement the method getCurrentTimeIframe!');
    }

    getCurrentDurationIframe() {
        throw new Error('You have to implement the method getCurrentDurationIframe!');
    }
}

//#region Websites

class ProxerAnime extends AnimeProvider {
    constructor() {
        super('Anime_Proxer');
        this.__HREF__ = ['proxer.me'];
    }

    getName() {
        return new Promise(async (res, rej) => {
            await waitForElement("#main .wName").catch(err => {
                rej(err);
            }).then(name => {
                let nameStr = name[0].innerText;
                res(nameStr);
            });
        })
    }

    getEpisode() {
        return new Promise(async (res, rej) => {
            await waitForElement("#main .wEp").catch(err => {
                rej(err);
            }).then(name => {
                let epiStr = name[0].innerText;
                res(parseInt(epiStr));
            });
        })
    }

    getCurrentTime() {
        return new Promise(async (res, rej) => {
            //Call super function because it relies on communicating with the iframe
            await this.waitTillIFrameCheckReady(IframeInjectionListeners.Time);
            GM_setValue(IframeInjectionListeners.Time, -1);

            let id = GM_addValueChangeListener(IframeInjectionListeners.Time, (name, oldVal, newVal) => {
                GM_removeValueChangeListener(id);
                GM_deleteValue(IframeInjectionListeners.Time);
                clearTimeout(timeout);
                utils.debug("newVal Time", newVal);
                if(newVal < 0){
                    utils.error("Sketchy time detected...", newVal);
                    res(0);
                    return;
                }
                res(newVal);
            })

            let timeout = setTimeout(() => {
                GM_removeValueChangeListener(id);
                GM_deleteValue(IframeInjectionListeners.Time);
                utils.error('Timedout while waiting for new Time!');
                res(0);
            }, 5000);
        })
    }

    getDuration() {
        return new Promise(async (res, rej) => {
            //Call super function because it relies on communicating with the iframe
            await this.waitTillIFrameCheckReady(IframeInjectionListeners.Duration);
            GM_setValue(IframeInjectionListeners.Duration, -1);

            let id = GM_addValueChangeListener(IframeInjectionListeners.Duration, (name, oldVal, newVal) => {
                GM_removeValueChangeListener(id);
                clearTimeout(timeout);
                res(newVal);
                GM_deleteValue(IframeInjectionListeners.Duration);
            })

            let timeout = setTimeout(() => {
                utils.error('Timedout while waiting for new Duration!');
                GM_removeValueChangeListener(id);
                GM_deleteValue(IframeInjectionListeners.Duration);
                res(-1);
            }, 5000);
        })
    }
}

class ProxerManga extends MangaProvider {
    constructor(){
        super('Manga_Proxer');
    }


}

class ProxerIframe extends ProviderIframe{
    constructor(){
        super();
        this.__HREF__ = ['stream.proxer.me'];
    }

    getCurrentTimeIframe() {
        return new Promise((res, rej) => {
            if(document.querySelector('video').plyr == null || document.querySelector('video').plyr == undefined){
                res(0);
                return;
            }
            res(document.querySelector('video').plyr.currentTime);
        })
    }

    getCurrentDurationIframe() {
        return new Promise((res, rej) => {
            if(document.querySelector('video').plyr == null || document.querySelector('video').plyr == undefined){
                rej('Could not find duratio!');
                return;
            }
            res(document.querySelector('video').plyr.duration);
        })
    }
}

class Crunchyroll extends AnimeProvider {
    constructor() {
        super('Anime_Crunchyroll');
        this.__HREF__ = ['www.crunchyroll.com'];
        //this.storageId = 'Anime_Crunchyroll';
        //this.anime_list = JSON.parse(GM_getValue(this.storageId, '{}'));
    }

    getName() {
        return new Promise(async (res, rej) => {
            await waitForElement(".text-link [itemprop=name]").catch(err => {
                rej(err);
            }).then(name => {
                let nameStr = name[0].innerText;
                res(nameStr);
            });
        })
    }

    getEpisode() {
        return new Promise(async (res, rej) => {
            await waitForElement(".collection-carousel-media-link-current .collection-carousel-overlay-top").catch(err => {
                rej(err);
            }).then(name => {
                let epiStr = name[0].innerText.replace('Episode ', '');
                res(parseInt(epiStr));
            });
        })
    }

    getCurrentTime() {
        return new Promise(async (res, rej) => {
            if (unsafeWindow.VILOS_PLAYERJS == null || unsafeWindow.VILOS_PLAYERJS == undefined) {
                res(0);
                return;
            }
            unsafeWindow.VILOS_PLAYERJS.getCurrentTime(res);
        })
    }

    getDuration() {
        return new Promise(async (res, rej) => {
            if (unsafeWindow.VILOS_PLAYERJS == null || unsafeWindow.VILOS_PLAYERJS == undefined) {
                res(-1);
                return;
            }
            unsafeWindow.VILOS_PLAYERJS.getDuration(res);
        })
    }
}

class Wakanim extends AnimeProvider {
    constructor() {
        super('Anime_Wakanim');
        this.__HREF__ = ['www.wakanim.tv'];
        //this.storageId = 'Anime_Crunchyroll';
        //this.anime_list = JSON.parse(GM_getValue(this.storageId, '{}'));
    }

    getName() {
        return new Promise(async (res, rej) => {
            await waitForElement(".episode_info .border-list").catch(err => {
                rej(err);
            }).then(parentEle => {
                let nameParent = parentEle[0].children[0];
                let nameEle = nameParent.querySelector('.border-list_text');
                let nameStr = nameEle.innerText.trim();
                res(nameStr);
            });
        })
    }

    getEpisode() {
        return new Promise(async (res, rej) => {
            await waitForElement(".episode_subtitle > span > span").catch(err => {
                rej(err);
            }).then(episodeEle => {
                let epiStr = episodeEle[0].innerText;
                res(parseInt(epiStr));
            });
        })
    }

    getCurrentTime() {
        return new Promise(async (res, rej) => {
            if (unsafeWindow.player2 == null || unsafeWindow.player2 == undefined) {
                res(0);
                return;
            }
            let time = unsafeWindow.player2.getCurrentTime();
            res(time);
        })
    }

    getDuration() {
        return new Promise(async (res, rej) => {
            if (unsafeWindow.player2 == null || unsafeWindow.player2 == undefined) {
                res(-1);
                return;
            }
            let duration = unsafeWindow.player2.getDuration();
            res(duration);
        })
    }
}


const SUPPORTED_WEBSITES = [ProxerAnime, ProxerManga, ProxerIframe, Crunchyroll, Wakanim];

//#endregion


/**
 * !TODO add manga support
 * !TODO make the prompt pretty
 */

class Anilist {
    /**
     *
     * @param {AnimeProvider} animeProvider
     */
    constructor(animeProvider) {
        this.user_id = GM_getValue('userid', null);
        this.auth_code = GM_getValue('authkey', null);
        this.animeProvider = animeProvider;
        this.idPrompt = false;

        if (this.auth_code == null)
            (async () => {
                this.authenticate().then(code => {
                    this.user_id = null;
                    GM_setValue('userid', null);
                })
            })();

        if (this.user_id == null && this.auth_code != null)
            this.getUserid().then(id => {
                this.user_id = id;
                GM_setValue('userid', id);
            })

    }

    authenticate() {
        return new Promise((res, rej) => {
            window.open('https://anilist.co/api/v2/oauth/authorize?client_id=3335&response_type=token', '_blank');
            this.auth_code = prompt('Please enter your code.');
            GM_setValue('authkey', this.auth_code);
            res(this.auth_code);
        })
    }

    getUserid() {
        return new Promise(async (res, rej) => {
            if (this.user_id != null) {
                res(this.user_id);
                return;
            }

            let query = `
            query {
                Viewer {
                    id
                }
            }`;

            let variables = {}

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data);
            let id = response.data.Viewer.id || null;
            res(id);
        });
    }

    getProgress(animeName) {
        return new Promise(async (res, rej) => {
            if (this.auth_code == null) {
                this.auth_code = await this.authenticate();
            }
            if (this.user_id == null) {
                this.user_id = await this.getUserid();
            }

            let idOfAnime = await this.getId(animeName).catch((err) => {
                rej(err);
                return;
            });

            let query = `
            query($id: Int, $userId: Int) {
                MediaList(mediaId: $id, userId: $userId){
                    progress
                }
            }`;

            let variables = {
                'userId': this.user_id,
                'id': idOfAnime
            }

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data).catch((errors) => {
                //Meaning the user doesnt have this anime in his list
                if(errors[0].message === 'Not Found.'){
                    res(-1);
                    return;
                }
                rej(errors);
                return;
            });

            //if for some reason the catch didnt fire this check should trigger when it did fail
            if(response == undefined){
                res(-1);
                return;
            }

            let progress = response.MediaList.progress;

            res(progress);
        });
    }

    getEpisodeCountOfAnime(animeName) {
        return new Promise(async (res, rej) => {
            if (this.auth_code == null) {
                this.auth_code = await this.authenticate();
            }
            if (this.user_id == null) {
                this.user_id = await this.getUserid();
            }

            let idOfAnime = await this.getId(animeName).catch((err) => {
                rej(err);
                return;
            });

            let query = `
            query($id: Int) {
                Media(id: $id){
                    episodes
                }
            }`;

            let variables = {
                'id': idOfAnime
            }

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data).catch((errors) => {
                //Meaning the user doesnt have this anime in his list
                if(errors[0].message === 'Not Found.'){
                    res(Infinity);
                    return;
                }
                rej(errors);
                return;
            });

            //if for some reason the catch didnt fire this check should trigger when it did fail
            if(response == undefined){
                res(Infinity);
                return;
            }

            let progress = response.Media.episodes;

            res(progress);
        });
    }

    getRepeatsOfAnime(animeName) {
        return new Promise(async (res, rej) => {
            if (this.auth_code == null) {
                this.auth_code = await this.authenticate();
            }
            if (this.user_id == null) {
                this.user_id = await this.getUserid();
            }

            let idOfAnime = await this.getId(animeName).catch((err) => {
                rej(err);
                return;
            });

            let query = `
            query($id: Int, $userId: Int) {
                MediaList(mediaId: $id, userId: $userId){
                    repeat
                }
            }`;

            let variables = {
                'userId': this.user_id,
                'id': idOfAnime
            }

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data).catch(errors => {
                //Meaning the user doesnt have this anime in his list
                if(errors[0].message === 'Not Found.'){
                    res(0);
                    return;
                }
                rej(errors);
                return;
            });

            //if for some reason the catch didnt fire this check should trigger when it did fail
            if(response == undefined){
                res(0);
                return;
            }

            let repeats = response.MediaList.repeat;

            res(repeats);
        });
    }

    getIdWait(animeName, type) {
        return new Promise(async (res, rej) => {
            if (this.auth_code == null) {
                this.auth_code = await this.authenticate();
            }
            if (this.user_id == null) {
                this.user_id = await this.getUserid();
            }

            if (!!this.animeProvider.hasId(animeName)) {
                //CHANGE THE FRICKING FUNCTION NAME!!!!
                res(this.animeProvider.getId(animeName));
                return;
            }


            let query = `
            query($search: String, $type: MediaType) {
                Page (page: 1, perPage: 10) {
                    media(search: $search, type: $type){
                        id
                        title{
                            romaji
                            english
                        }
                    }
                }
            }`;

            let variables = {
                'search': animeName,
                'type': type
            };

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data);
            let animeTitles = response.Page.media;

            let string = "Please select the correct Anime! (Default 0)\n\r";
            for (let index = 0; index < animeTitles.length; index++) {
                string += `[${index}] ` + animeTitles[index].title.romaji + " - " + animeTitles[index].title.english + '\n\r';
            }

            let sel = prompt(string);

            //User pressed cancel
            if(sel == null){
                rej("User canceld!");
            }

            if (sel == '')
                sel = '0';

            sel = parseInt(sel);

            let id = animeTitles[sel].id;

            this.animeProvider.addId(animeName, id);

            res(id);
        });
    }

    getId(animeName,type=MediaType.ANIME) {
        return new Promise(async (res, rej) => {
            if(!this.idPrompt){
                this.idPrompt = true;
                let id = await (this.getIdWait(animeName, type)).catch((err) => {
                    rej(err);
                    return;
                });
                res(id);
                this.idPrompt = false;
            }else{
                while(this.idPrompt){
                    await wait(100);
                }
                let id = await (this.getIdWait(animeName, type)).catch((err) => {
                    rej(err);
                    return;
                });
                res(id);
            }
        })
    }

    /**
     *
     * @param {String} name
     * @param {int} progress
     * @param {MediaStatus} status
     * @param {MediaType} type
     */

    updateMediaEntry(name, progress, status, repeats, type){
        return new Promise(async (res, rej) => {
            if (this.auth_code == null) {
                this.auth_code = await this.authenticate();
            }
            if (this.user_id == null) {
                this.user_id = await this.getUserid();
            }

            let idOfAnime = await this.getId(name).catch((err) => {
                rej(err);
                return;
            });

            let query = `
            mutation($mediaId: Int, $episode: Int, $volume: Int, $repeats: Int, $status: MediaListStatus) {
                SaveMediaListEntry(mediaId: $mediaId, progress: $episode, progressVolumes: $volume, status: $status, repeat: $repeats){
                    progress
                }
            }`;

            let variables = {
                mediaId: idOfAnime,
                repeats: repeats,
                status: status
            }

            if(type == MediaType.ANIME)
                variables.episode = progress;
            else
                variables.volume = progress;

            let data = {
                query,
                variables
            }

            let response = await this.sendRequest(data);
            res(response);
        });
    }

    sendRequest(data) {
        return new Promise((res, rej) => {
            let req = {
                'url': 'https://graphql.anilist.co',
                'method': 'POST',
                'headers': {
                    'Authorization': 'Bearer ' + this.auth_code,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                'data': JSON.stringify(data),
            }

            req.onload = ((resp) => {
                utils.log(`${resp.response}`);
                let response = JSON.parse(resp.response);
                if(!!response.errors){
                    rej(response.errors);
                    return;
                }
                res(response.data);
            })

            req.onerror = ((err) => {
                rej(err);
            })

            GM_xmlhttpRequest(req);
        })
    }
}
//#endregion

async function main(){

    let anime = new AnimeProvider(); //need this for vs code hehe
    for (let index = 0; index < SUPPORTED_WEBSITES.length; index++) {
        const websiteCL = SUPPORTED_WEBSITES[index];
        const website = new websiteCL();

        if(website.__HREF__.includes(document.location.host)){
            anime = website;
            break;
        }
    }
    if(typeof(anime) == AnimeProvider){
        throw new Error("Site not supported: " + document.location.host);
        return;
    }

    // Your code here...
    /*switch (document.location.host) {
        case 'proxer.me':
            anime = new ProxerAnime();
            break;

        case 'stream.proxer.me':
            anime = new ProxerIframe();
            break;

        case 'www.crunchyroll.com':
            anime = new Crunchyroll();
            break;

        default:
            throw new Error("Site not supported: " + document.location.host);
            return;
            break;
    }*/

    if(isIframe()){
        addIframeListeners(anime);
        return;
    }

    let anilist = new Anilist(anime);

    let animeInfo = {
        name: null,
        episode: null,
        episodeCount: null,
        progress: null,
        repeats: null,
        season: 1
    }

    anime.getEpisode().then(episode => animeInfo.episode = episode);
    anime.getName().then(name => {
        animeInfo.name = name;

        anilist.getProgress(name).then(progress => animeInfo.progress = progress);
        anilist.getEpisodeCountOfAnime(name).then(count => animeInfo.episodeCount = count);
        anilist.getRepeatsOfAnime(name).then(repeats => animeInfo.repeats = repeats);
    });

    let hasUpdated = false;

    let update = async(sleep=5) => {
        await wait(sleep);

        //Check if the Anime is split
        if(!hasNull(animeInfo)){
            if(animeInfo.episode > animeInfo.episodeCount){
                animeInfo.season++;
                animeInfo.episode -= animeInfo.episodeCount;
                animeInfo.episodeCount = null;

                anilist.getId(animeInfo.name + ' part ' + animeInfo.season).then(() => {
                    anilist.getProgress(animeInfo.name + ' part ' + animeInfo.season).then(progress => animeInfo.progress = progress);
                    anilist.getEpisodeCountOfAnime(animeInfo.name + ' part ' + animeInfo.season).then(count => animeInfo.episodeCount = count);
                    anilist.getRepeatsOfAnime(animeInfo.name + ' part ' + animeInfo.season).then(repeats => animeInfo.repeats = repeats);
                }).catch((err) => {
                    utils.error(err);
                    return;
                })

                update(1000);
                return;
            }
        }

        if(!hasNull(animeInfo)){
            //!TODO - Split the progress to its own class, because animeInfo sound weird in that context...
            //Check if the Anime was previosly completed and if the current watched episode is the first one > if yes then ask if the user wants to flag as rewatching
            if(animeInfo.progress === animeInfo.episodeCount && animeInfo.episode == 1){
                if(confirm("Mark anime as repeating?")){
                    //Repeating
                    utils.log("Repeating anime!");
                    animeInfo.progress = -1;
                    animeInfo.repeats++;
                }else{
                    utils.log("Anime has been completed before, and user did not want to repeat!");
                    return;
                }
            }


            if(animeInfo.progress === animeInfo.episode || (!GM_config.get('Update_old') && animeInfo.episode < animeInfo.progress)){
                utils.log("Current episode is same or smaller as progress aborting!");
                return;
            }
        }else{
            utils.log("Animeinfo still empty", animeInfo);
            await wait(5);
            update();
            return;
        }

        let time = await anime.getCurrentTime();
        let duration = await anime.getDuration();
        utils.debug("time", time);
        utils.debug("dura", duration);
        let perc = time/duration*100;

        utils.debug(perc);


        if(!isNaN(perc) && perc >= GM_config.get('Watch_Time') && !hasUpdated && !hasNull(animeInfo)){
            hasUpdated = true;

            console.log('-----------------------------');
            console.log(animeInfo);

            //return;

            let status = animeInfo.episode === animeInfo.episodeCount ? MediaStatus.COMPLETED : animeInfo.repeats > 0 ? MediaStatus.REPEATING : MediaStatus.CURRENT;
            utils.log("UPDATING!!!");
            anilist.updateMediaEntry(animeInfo.name + (animeInfo.season > 1 ? ` part ${animeInfo.season}` : ""), animeInfo.episode, status, animeInfo.repeats, MediaType.ANIME).catch(err => {
                hasUpdated = false;
                utils.error(err);
                update();
            }).then(() => {
                utils.log("Updated anilist entry!");
            })
            return;
        }

        update();
        return;
    }
    update();

    //anilist.updateMediaEntry(await anime.getName(), await anime.getEpisode(), MediaStatus.CURRENT, MediaType.ANIME);
}

function waitForElement(selectors, timeout = 1000) {
    return new Promise(async (res, rej) => {
        let time = 0;
        if (!Array.isArray(selectors))
            selectors = [selectors];

        let eles = [];

        selectors.forEach(async (sel, i) => {
            let ele = document.querySelector(sel);
            while (ele == null || ele == undefined) {
                if (time >= timeout) {
                    utils.error("Timed out while waiting for: ", sel);
                    rej();
                    return;
                }

                time += 10;
                await wait(10);
                ele = document.querySelector(sel);
            }
            eles.push(ele);
            if (i == (selectors.length - 1))
                res(eles);
        });
    })
}

function wait(ms) {
    return new Promise(res => setTimeout(res, ms))
}

function isIframe(){
    return window.self !== window.top;
}

function addIframeListeners(anime){
    GM_setValue(IframeInjectionListeners.Time, -2);
    GM_addValueChangeListener(IframeInjectionListeners.Time, async(name, oldVal, newVal) => {
        if(newVal == -1 && typeof(anime.getCurrentTimeIframe) === 'function'){
            anime.getCurrentTimeIframe().then((time) => {
                GM_setValue(IframeInjectionListeners.Time, time);
            })
        }
    });

    GM_setValue(IframeInjectionListeners.Duration, -2);
    GM_addValueChangeListener(IframeInjectionListeners.Duration, async(name, oldVal, newVal) => {
        if(newVal == -1 && typeof(anime.getCurrentDurationIframe) === 'function'){
            anime.getCurrentDurationIframe().then((time) => {
                GM_setValue(IframeInjectionListeners.Duration, time);
            })
        }
    });
}

function hasNull(json){
    let keys = Object.keys(json);
    for(let i = 0; i < keys.length; i++){
        if(json[keys[i]] == null)
            return true;
    }
    return false;
}

GM_config.init({
    'id': 'config',
    'fields': {
        'Watch_Time': {
            'label': 'Minimum Watch time before updating (%)',
            'type': 'int',
            'default': 75,
            'min': 0,
            'max': 100
        },
        'Update_old': {
            'label': 'Update when current episode is below already watched episode',
            'type': 'checkbox',
            'default': false
        },
        'Debug_log': {
            'label': 'Output debug logs',
            'type': 'checkbox',
            'default': false
        }
    }
})

GM_registerMenuCommand('Manage settings', (() => {GM_config.open();}))
main();
