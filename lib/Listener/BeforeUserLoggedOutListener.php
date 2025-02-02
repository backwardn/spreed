<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2020 Joas Schilling <coding@schilljs.com>
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

namespace OCA\Talk\Listener;

use OCA\Talk\Manager;
use OCA\Talk\Participant;
use OCA\Talk\TalkSession;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IUser;
use OCP\User\Events\BeforeUserLoggedOutEvent;

class BeforeUserLoggedOutListener implements IEventListener {

	/** @var Manager */
	private $manager;
	/** @var TalkSession */
	private $talkSession;

	public function __construct(Manager $manager,
								TalkSession $talkSession) {
		$this->manager = $manager;
		$this->talkSession = $talkSession;
	}

	public function handle(Event $event): void {
		if (!($event instanceof BeforeUserLoggedOutEvent)) {
			// Unrelated
			return;
		}

		$user = $event->getUser();
		if (!$user instanceof IUser) {
			// User already not there anymore, so well …
			return;
		}

		$sessionIds = $this->talkSession->getAllActiveSessions();
		foreach ($sessionIds as $sessionId) {
			$room = $this->manager->getRoomForSession($user->getUID(), $sessionId);
			$participant = $room->getParticipant($user->getUID());
			if ($participant->getInCallFlags() !== Participant::FLAG_DISCONNECTED) {
				$room->changeInCall($participant, Participant::FLAG_DISCONNECTED);
			}
			$room->leaveRoom($user->getUID(), $sessionId);
		}
	}
}
