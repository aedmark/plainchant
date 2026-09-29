(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Adventure = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const COMMANDS = {
        'look': 'look', 'look around': 'look',
        'inventory': 'inventory', 'inv': 'inventory', 'take inventory': 'inventory',
        'score': 'score',
        'xyzzy': 'xyzzy',
        'plugh': 'plugh',
        'get all': 'all', 'take all': 'all',
        'save game': 'save',
        'restore game': 'restore'
    };

    function command(line) {
        const key = String(line || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return Object.prototype.hasOwnProperty.call(COMMANDS, key) ? COMMANDS[key] : null;
    }

    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

    function names(list) {
        if (list.length < 2) return list.join('');
        return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
    }

    function reply(key, facts) {
        const f = facts || {};
        const who = f.characters || [];
        switch (key) {
            case 'look':
                if (!f.scene) return 'You are on a page with no scene heading yet. It is very quiet. Obvious exits: INT. and EXT.';
                return 'You are in ' + f.scene + '. ' +
                    (who.length ? names(who) + (who.length === 1 ? ' is' : ' are') + ' here.' : 'Nobody speaks here yet.');
            case 'inventory':
                return 'You are carrying ' + plural(f.words || 0, 'word', 'words') + ', ' +
                    plural(f.scripts || 0, 'script', 'scripts') + ' and an unreasonable amount of coffee.';
            case 'score':
                return 'Your score is ' + (f.pages || 0) + ' out of a possible 120 pages.';
            case 'xyzzy':
                return 'Nothing happens.';
            case 'plugh':
                return 'A hollow voice says “Plugh.”';
            case 'all':
                return 'You can’t take it all with you. Export can, though.';
            case 'save':
                return 'Saved. It always is: Plainchant saves as you type.';
            case 'restore':
                return 'Every earlier version of this script is in the Library, under Versions.';
            default:
                return '';
        }
    }

    return { command: command, reply: reply };
});
