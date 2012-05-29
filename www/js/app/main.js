// Defines the main app module. This one does the top level app wiring.

define(function (require) {
    'use strict';

    var $ = require('jquery'),
        Backbone = require('backbone'),
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

        var StoryList = Backbone.Collection.extend({
          model : Story,
          comparator : function comparator(story) {
            return (Date.parse(story.get("pubDate").$text) * -1);
          },
          initialize : function () {
          },
          url : '/stories',
          parse: function(response) {
            if (response && response.list && response.list.story) {
                return response.list.story;
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
                itemSelector: '.story-item'
            });

          },
          render : function (eventName) {
            _.each(this.model.models, function (story) {
              if ($("#story-" + story.id, this.el).length <= 0) {
                $(this.el).append((new StoryListItemView({model:story, id : "#story-" + story.id})).render().el);
              }
            }, this);

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
                Stories.fetch();
              this.StoryListView = new StoryListView({model:Stories});
            },
            list : function () {
              if ($("div.stories").length <= 0) {
                $('#content').append(this.StoryListView.render().el);
              }
              //$("ul.stories").fadeIn("fast", function() { $win.scrollTop((this.scrollPosition)? $(this.scrollPosition).offset().top : 0 ); });
            },
            getStory : function (id) {
              // TODO: remember scroll position
              $("ul.stories").hide();
              this.scrollPosition = "#story-" + id;
              var story = window.Stories.get(id);
              if (story == null) {
                console.log("story == null");
                StoriesStore.on("ready",
                              function waitfordb() {
                                console.log("story == null");
                                StoriesStore.off("ready", waitfordb, this);
                                app.getStory(id);
                                console.log("story == null");
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

        var app = new AppRouter();
        Backbone.history.start();

    });
});
