// Defines the main app module. This one does the top level app wiring.

define(function (require) {
    'use strict';

    var $ = require('jquery'),
        Backbone = require('backbone'),
        Store = require("backbone-idb"),
        _ = require('underscore'),
        moment = require("moment");

    // Dependencies that do not have an export of their own, just attach
    // to other objects, like jQuery. These are just used in the example
    // bootstrap modal, not directly in the UI for the network and appCache
    // displays.
    require('bootstrap/collapse');
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
        //require('./uiAppCache')();
        require('./uiWebAppInstall');

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
            //console.log("compare", story);
            return (Date.parse(story.get("pubDate").$text) * -1);
          },
          initialize : function () {
            var collection = this;
            // when the file system is ready run a fetch on the local items
            // after our local fetch run a pull against the remote server for new items
            this.fs.on("ready", function() { collection.fetch({ success : function(collect, list) { collection.reset(list); collection.pull(); } });  }, this);
          },
          // read from the remote server and save all items in the local storage as they arrive
          pull: function() {
            var options =  { parse : true };
            var collection = this;
            options.success = function(resp, status, xhr) {
              // here we need to examine the results and only add
              // items which are new, otherwise we get this odd reset pattern
              if (collection.models.length <= 0) {
                collection['reset'](collection.parse(resp, xhr), options);
                _.each(collection.models, function(story) {
                  story.save();
                });
              } else {
                _.each(collection.parse(resp, xhr), function(story) {
                  var model = collection.get(story.id);
                  if (!model) {
                    model = collection.add(story);
                    console.log(model);
                  }
                });
              }
            };
            options.error = Backbone.wrapError(options.error, collection, options);
            return (this.sync || Backbone.sync).call(this, 'pull', this, options);
          },
          url : '/stories',
          parse: function(response) {
            //console.log("parse", response);
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

        var StoriesListView = Backbone.View.extend({
          tagName:  "div",
          className: "stories",
          initialize : function () {
            this.model.bind("change", this.render, this);
            this.model.bind("reset", this.render, this);

            $(this.el).masonry({
                itemSelector: '.story-item',
                gutterWidth : 10,
                columnWidth: function( containerWidth ) {
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
            //console.log(ev);
            App.navigate("story/" + $(ev.currentTarget).attr("id").replace("story-",""), {trigger: true});
          },
          render : function() {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
          }
        });

        var StoryListView = new StoriesListView({model:Stories, id : "stories"});

        var StoryView = Backbone.View.extend({
          tagName:  "div",
          className: "story-view",
          template: _.template($('#story-view-template').html()),
          initialize : function() {
            //this.model.bind("reset", this.render, this);
          },
          events: {
            "click button.add" : "addToPlaylist"
          },
          addToPlaylist : function(e) {
            //console.log(e);
            //console.log(this);
            //window.PlayListItems.add(new Story(this.model.toJSON()));
          },
          render : function() {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
          }
        });

        // Router
        var AppRouter = Backbone.Router.extend({
            routes : {
              "":"list",
              "story/:id":"getStory"
            },
            initialize : function () {

            },
            list : function () {
              $("#story").hide();

              if ($("#stories").length <= 0) {
                var $stories = StoryListView.render().el;
                $('#content').append($stories);
                $($stories).masonry('reload');
              }
              $("#stories").fadeIn("fast");
              //$("ul.stories").fadeIn("fast", function() { $win.scrollTop((this.scrollPosition)? $(this.scrollPosition).offset().top : 0 ); });
            },
            getStory : function (id) {
              $("#stories").hide();
              //console.log("Stories", Stories, id, Stories.get(id));

              var story = Stories.get(id);
              if (story) {
                var StoryPageView = new StoryView({model:story, id : "story"});
                this.$story = StoryPageView.render().el;

                if ($("#story").length <= 0) {
                  $('#content').append(this.$story);
                } else {
                  $("#story").replaceWith(this.$story)
                }
                //$("div.story").fadeIn("fast", function() { $win.scrollTop(0); });
              } else {
                console.log("story == null");
              }
            }
        });

        var App = null;
        Stories.fs.on("ready", function() {
          App = new AppRouter();
          Backbone.history.start({pushState: true});
        });

    });
});
