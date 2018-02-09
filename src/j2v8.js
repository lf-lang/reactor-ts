/** Get a resource.
 *  Below are the types of resources that are handled
 *  all other resources will cause an error.
 *
 *  * $KEYSTORE is replaced with $HOME/.ptKeystore
 *
 *  @param uri A specification for the resource.
 */
var getResource = function (uri) {

    // We might want the Node host (and in fact all hosts) to allow access to
    // resources that are given with relative paths. By default, these would
    // get resolved relative to the location of the file defining the swarmlet.
    // This might even work in the Browser host with the same source
    // policy.

    if (uri.startsWith('$KEYSTORE') === true) {
        var home = process.env.HOME;
        if (home === undefined) {
            throw new Error('Could not get $HOME from the environment to expand ' + uri);
        } else {
            uri = uri.replace('$KEYSTORE', home + path.sep + '.ptKeystore');
            code = fs.readFileSync(uri, 'utf8');
            return code;
        }
    }
    throw new Error('getResouce(' + uri + ', ' + timeout + ') only supports $KEYSTORE, not ' +
        uri);
}

var bindings = {
        'require': require,
        'getResource': getResource // FIXME: add more bindings
};
