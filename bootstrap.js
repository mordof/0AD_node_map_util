const fs = require('fs');
const vm = require('vm');
const minimatch = require('minimatch');
const xmlParser = require('fast-xml-parser');
const deepmerge = require('deepmerge');
const util = require('util');

const DEBUG = false;
const SHOW_ENGINE_PROGRESS = true;
const SHOW_MAP_EXPORT_DATA = true;
const ENABLE_SCRIPT_LOG = true;

const MAP_SETTINGS = {
    Name: "Unnamed map",
    Description: "Give an interesting description of your map.",
    Size: 512, // no idea what the 'divisible by patches' reference is to. got this size from map_sizes.json: 'giant' size.
    PlayerData: [
        { Civ: "athen" },
        { Civ: "cart" },
        { Civ: "gaul" },
        { Civ: "iber" },
        { Civ: "mace" },
        { Civ: "pers" },
        { Civ: "rome" },
        { Civ: "spart" }
    ],
    CircularMap: true,
    VictoryConditions: [
        "conquest"
    ]
}

const log = (...msg) => {
    if (DEBUG) {
        console.log(...msg);
    }
}

const loadFile = (path) => {
    log("Load Script: ", path);

    const script = new vm.Script(fs.readFileSync(path, 'utf8'), { filename: path });
    script.runInContext(globalContext, {
        displayErrors: true
    });
}

function flattenDeep(arr1) {
    return arr1.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
}

const Engine = {
    LoadLibrary: (path, attemptedScopeChange = false) => {
        log("Load Library: ", path);

        try {
            fs.lstatSync(path)
        } catch {
            if (attemptedScopeChange) {
                throw `Library ${path} not found.`;
            } else {
                return Engine.LoadLibrary(`../../${path}`, true)
            }
        }

        if (fs.lstatSync(path).isDirectory()){
            fs.readdirSync(path).forEach((file) => {
                if (!fs.lstatSync(`${path}/${file}`).isDirectory()) {
                    loadFile(`${path}/${file}`);
                }
            })
        } else {
            loadFile(path);
        }
    },
    GetTerrainTileSize: () => 4,
    ReadJSONFile: (file) => {
        log("Read JSON File: ", file);
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    },
    ListDirectoryFiles: (path, glob, recurse, attemptedScopeChange = false) => {
        const cleanPath = path.replace(/\/$/, '');

        log("List Directory Files: ", cleanPath, glob, recurse);

        try {
            fs.lstatSync(cleanPath);
        } catch {
            if (attemptedScopeChange) {
                throw `Directory ${path} not found.`;
            } else {
                return Engine.ListDirectoryFiles(`../../${path}`, glob, recurse, true);
            }
        }

        return flattenDeep(fs.readdirSync(`${cleanPath}`).map(file => {
            if (fs.lstatSync(`${cleanPath}/${file}`).isDirectory() && recurse){
                return Engine.ListDirectoryFiles(`${cleanPath}/${file}/`, glob, recurse);
            }

            if (minimatch(file, glob)) {
                return `${cleanPath}/${file}`;
            }
        }))
    },
    GetTemplate: (path, depth = 0) => {
        log("Get Template: ", path, depth);

        if (TemplateCache[path]) {
            if (depth === 0){
                return deepmerge({}, TemplateCache[path].Entity);
            } else {
                return deepmerge({}, TemplateCache[path]);
            }
        }

        if (depth > 100) {
            throw new Error(`Probable infinite inheritance loop in entity template ${path}`);
        }

        const templateFile = fs.readFileSync(`../../simulation/templates/${path}.xml`, 'utf8');
        const template = xmlParser.parse(templateFile, { ignoreAttributes: false });

        if (template.Entity['@_parent']) {
            const parentName = template.Entity['@_parent'];
            delete template.Entity['@_parent'];
            const parentTemplate = Engine.GetTemplate(parentName, depth + 1);

            TemplateCache[path] = deepmerge(parentTemplate, template)
        } else {
            TemplateCache[path] = deepmerge({}, template);
        }

        if (depth === 0){
            return deepmerge({}, TemplateCache[path].Entity);
        } else {
            return deepmerge({}, TemplateCache[path]);
        }
    },
    SetProgress: (progress) => SHOW_ENGINE_PROGRESS && console.log("Engine Progress: ", progress),
    ExportMap: (mapDetails) => SHOW_MAP_EXPORT_DATA && console.log("ExportMap Data: ", util.inspect(mapDetails, true, null, true))
}

const TemplateCache = {}

const Sandbox = {
    Engine: Engine,
    markForTranslationWithContext: (ctx, id) => id,
    deepfreeze: (obj) => Object.freeze(obj),
    g_MapSettings: Object.freeze(MAP_SETTINGS),
}

const globalContext = vm.createContext(Sandbox);

globalContext.global = globalContext;
globalContext.log = (...args) => ENABLE_SCRIPT_LOG && console.log('Log: ', ...args);
globalContext.print = (...args) =>  ENABLE_SCRIPT_LOG && console.log('Print: ', ...args);

Engine.LoadLibrary('../../globalscripts');

Engine.LoadLibrary('aegean_sea.js');