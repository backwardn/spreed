/* global Backbone, OC, OCA */

/**
 *
 * @copyright Copyright (c) 2017, Daniel Calviño Sánchez (danxuliu@gmail.com)
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function(OCA, OC, Backbone) {
	'use strict';

	OCA.SpreedMe = OCA.SpreedMe || {};
	OCA.SpreedMe.Models = OCA.SpreedMe.Models || {};

	/**
	 * Collection for chat messages.
	 *
	 * The ChatMessageCollection gives read access to all the chat messages from
	 * a specific chat room. The room token must be provided in the constructor
	 * options (as "token"), either as an actual room token or as null. It is
	 * possible to change the room of a ChatMessageCollection at any time by
	 * calling "setRoomToken". In any case, although null is supported as a
	 * temporal or reset value, note that an actual room token must be set
	 * before synchronizing the collection.
	 *
	 * "read" is the only synchronization method allowed; chat messages can not
	 * be edited nor deleted, and to send a new message a standalone ChatMessage
	 * should be used instead.
	 *
	 * To get the messages from the server "receiveMessages" should be used. It
	 * will enable polling to the server and automatically update the collection
	 * when new messages are received. Once enabled, the polling will go on
	 * indefinitely. Due to this "stopReceivingMessages" must be called once
	 * the ChatMessageCollection is no longer needed.
	 */
	var ChatMessageCollection = Backbone.Collection.extend({

		model: OCA.SpreedMe.Models.ChatMessage,

		initialize: function(models, options) {
			if (options.token === undefined) {
				throw 'Missing parameter token';
			}

			this._lastFetch = null;

			this.setRoomToken(options.token);
		},

		parse: function(result) {
			return result.ocs.data;
		},

		/**
		 * Changes the room that this ChatMessageCollection gets its messages
		 * from.
		 *
		 * When a token is set this collection is reset, so the messages from
		 * the previous room are removed.
		 *
		 * If polling was currently being done to the previous room it will be
		 * automatically stopped. Note, however, that "receiveMessages" must be
		 * explicitly called if needed.
		 *
		 * @param {?string} token the token of the room.
		 */
		setRoomToken: function(token) {
			this.stopReceivingMessages();

			this.token = token;

			this.lastKnownMessageId = -1;

			this._waitTimeUntilRetry = 1;

			if (token !== null) {
				this.url = OC.linkToOCS('apps/spreed/api/v1/chat', 2) + token;
			} else {
				this.url = null;
			}

			this.reset();
		},

		updateGuestName: function(sessionId, newDisplayName) {
			this.invoke('updateGuestName', {sessionId: sessionId, displayName: newDisplayName});
		},

		receiveMessages: function() {
			this.receiveMessagesAgain = true;

			this._lastFetch = this.fetch({
				data: {
					lastKnownMessageId: this.lastKnownMessageId,
					lookIntoFuture: 1
				},
				success: _.bind(this._successfulFetch, this),
				error: _.bind(this._failedFetch, this)
			});
		},

		stopReceivingMessages: function() {
			this.receiveMessagesAgain = false;

			if (this._lastFetch !== null) {
				this._lastFetch.abort();
			}
		},

		_successfulFetch: function(collection, response, options) {
			var lastKnownMessageId = options.xhr.getResponseHeader("X-Chat-Last-Given");
			if (lastKnownMessageId !== null) {
				this.lastKnownMessageId = lastKnownMessageId;
			}

			this._lastFetch = null;

			this._waitTimeUntilRetry = 1;

			if (this.receiveMessagesAgain) {
				this.receiveMessages();
			}
		},

		_failedFetch: function() {
			this._lastFetch = null;

			if (this.receiveMessagesAgain) {
				_.delay(_.bind(this.receiveMessages, this), this._waitTimeUntilRetry * 1000);

				// Increase the wait time until retry to at most 64 seconds.
				if (this._waitTimeUntilRetry < 64) {
					this._waitTimeUntilRetry *= 2;
				}
			}
		}

	});

	OCA.SpreedMe.Models.ChatMessageCollection = ChatMessageCollection;

})(OCA, OC, Backbone);
