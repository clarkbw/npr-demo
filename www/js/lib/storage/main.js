/**
 * Handles the storage requirements for the app.
 * Prefers a storage capability that does not
 * prompt the user for storage, unless asked.
 */

define(['./Lawnchair'], function (LawnChair) {
    return {

        create: function (options, callback) {
            return new LawnChair(options, callback);
        },

        createNoPrompt: function (options, callback) {
            //Do something here if we want a non-prompting
            //db storage. So for example, remove the indexeddb
            //option and just use memory if we do not want to
            //prompt the user. More advanced, allow usage of
            //localStorage, but aggressively purge it.
        },

        transferToPersistent: function (storage, callback, errback) {
            //Companion to createNoPrompt: once we want to prompt
            //because the user has installed the app, transfer any
            //in-memory storage to the permanent one.
        }
    }

});