// Defines the main app module. This one does the top level app wiring.

define(function (require) {
    'use strict';

    var $ = require('jquery'),
        Backbone = require('backbone'),
        Store = require("backbone-storage"),
        _ = require('underscore'),
        moment = require("moment");

    // Dependencies that do not have an export of their own, just attach
    // to other objects, like jQuery. These are just used in the example
    // bootstrap modal, not directly in the UI for the network and appCache
    // displays.
    require('bootstrap/transition');
    require('masonry/jquery.masonry');

    // These are all used in the templates
    _.mixin({
      ago : function ago(date) { return moment(date).fromNow(); },
      seconds : function seconds(secs) { return moment.duration(parseInt(secs), "seconds").humanize(); }
    });

    // Wait for the DOM to be ready before showing the network and appCache
    // state.
    $(function () {
        // Enable the UI bindings for the network and appCache displays
        require('./uiNetwork')();
        require('./uiAppCache')();

        // fix sub nav on scroll
        var $win = $(window)
          , $nav = $('.subnav')
          , navTop = $('.subnav').length && $('.subnav').offset().top - 40
          , isFixed = 0

        function processScroll() {
          var i, scrollTop = $win.scrollTop()
          if (scrollTop >= navTop && !isFixed) {
            isFixed = 1
            $nav.addClass('subnav-fixed')
          } else if (scrollTop <= navTop && isFixed) {
            isFixed = 0
            $nav.removeClass('subnav-fixed')
          }
        }
        processScroll()
        $win.on('scroll', processScroll);

        var Story = Backbone.Model.extend({
          idAttribute : "id"
        });

        var StoriesStore = new Store("stories");

        var StoryList = Backbone.Collection.extend({
          model : Story,
          fs: StoriesStore,
          comparator : function comparator(story) {
            return (Date.parse(story.get("pubDate").$text) * -1);
          },
          initialize : function () {
            var collection = this;
            // when the file system is ready run a fetch on the local items
            // after our local fetch run a pull against the remote server for new items
            this.fs.on("ready", function() { collection.fetch(); collection.pull(); }, this);
          },
          // read from the remote server and save all items in the local storage as they arrive
          pull: function() {
            var options =  { parse : true };
            var collection = this;
            options.success = function(resp, status, xhr) {
              collection['reset'](collection.parse(resp, xhr), options);
              try {
                _.each(collection.models, function(story) {
                  try {
                    story.save();
                  } catch (e) {
                    console.log(e);
                  }
                });
              } catch (e) { console.log("error saving", e); }
            };
            options.error = Backbone.wrapError(options.error, collection, options);
            return (this.sync || Backbone.sync).call(this, 'pull', this, options);
          },
          url : '/stories',
          parse: function(response) {
            // a remote response will return this list / story object
            if (response && response.list && response.list.story) {
                return response.list.story;
            // the local storage returns an array of objects
            } else if (_.isArray(response)) {
              return response;
            }
            return null;
          }
        });

        var Stories = new StoryList;

        var StoryListView = Backbone.View.extend({
          tagName:  "div",
          className: "stories",
          initialize : function () {
            this.model.bind("reset", this.render, this);

            $(this.el).masonry({
                itemSelector: '.story-item',
                gutterWidth : 10,
                columnWidth: function( containerWidth ) {
                  console.log( "containerWidth", containerWidth);
                  if ( containerWidth <= 580) {
                    return containerWidth;
                  }
                  // 1/2 the item size
                  return 135;
                }
            });
          },
          render : function (eventName) {
            _.each(this.model.models, function (story) {
              if ($("#story-" + story.id, this.el).length <= 0) {
                var $story = (new StoryListItemView({model:story, id : "story-" + story.id})).render().el;
                $(this.el).append($story); //.masonry('appended', $story);
              }
            }, this);

            // let masonry know that we've added new items
            $(this.el).masonry('reload');

            return this;
          }
        });

        var StoryListItemView = Backbone.View.extend({
          tagName : "div",
          className : "story-item",
          template: _.template($('#story-item-template').html()),
          initialize : function() {
            //this.model.bind("change", this.render, this);
            this.model.bind("reset", this.render, this);
          },
          events: {
            "click" : "view"
          },
          view : function(ev) {
            console.log(ev);
            App.navigate("story/" + $(ev.currentTarget).attr("id").replace("story-",""), {trigger: true});
          },
          render : function() {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
          }
        });

        // Router
        var AppRouter = Backbone.Router.extend({
            scrollPosition : null,
            routes : {
              "":"list",
              "story/:id":"getStory"
            },
            initialize : function () {
              this.StoryListView = new StoryListView({model:Stories});
              this.$stories = null;
              this.$story = null;
            },
            list : function () {
              if (!this.$stories) {
                this.$stories = this.StoryListView.render().el;
              }
              $('#content').append(this.$stories).fadeIn("fast");
              //$("ul.stories").fadeIn("fast", function() { $win.scrollTop((this.scrollPosition)? $(this.scrollPosition).offset().top : 0 ); });
            },
            getStory : function (id) {
              // TODO: remember scroll position
              this.$stories = $("div.stories").remove();

              var story = Stories.get(id);
              if (story == null) {
                var app = this;
                console.log("story == null");
                StoriesStore.on("ready",
                              function waitfordb() {
                                console.log("story == null");
                                StoriesStore.off("ready", waitfordb, this);
                                return app.getStory(id);
                              },
                              this);
                return;
              }
              //console.log(id, window.Stories, story);
              var view = new window.StoryView({model:story});

              if ($("div.story").length <= 0) {
                $('#content').append(view.render().el);
              } else {
                $("div.story").html(view.render().el)
              }
              $("div.story").fadeIn("fast", function() { $win.scrollTop(0); });

            }
        });

        var App = new AppRouter();
        Backbone.history.start();

    });
});
