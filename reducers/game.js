// player roles - do we even need this?
const GUESSER = 'guesser';
const SPYMASTER = 'spymaster';

// turn phases
const GIVE_CLUE = 'give clue';
const GUESS = 'guess';

const SKIP = 'skip';
const BY_GODS_MANDATE = 'because i say so';

import { RED, BLUE, KILL } from './constants';
import { merge } from './utils';
import { Board } from './board';

// needed?
export class Player {
  constructor(team, role) {
    this.team = team;
    this.role = role;
  }
}

export class Clue {
  constructor(word, count) {
    this.word = word;
    this.count = count;
  }
}

// action creators
function giveClue(player, clue) {
  return {
    type: GIVE_CLUE,
    player,
    clue,
  };
}

function guess(player, word) {
  return {
    type: GUESS,
    player,
    word: normalizeWord(word)
  };
}

function skip(player) {
  return {
    type: SKIP,
    player,
  }
}

function initialState(board) {
  return {
    phase: GIVE_CLUE,
    remainingGuesses: null,
    clueHistory: [],
    team: board.startingTeam,
    // board maintains its own mutable state - but we can clone it!
    board: board,
    // will set to the winning team when it habbens
    winner: null,
  }
}

// TODO: HANDLE TIMEOUTS WITH A TIMER_TICK ACTION

function nextTeam(team) {
  if (team === RED) return BLUE;
  if (team === BLUE) return RED;
  throw new Error(`wat: should not have unknown team ${team}`);
}

function nextPhase(phase) {
  if (phase === GIVE_CLUE) return GUESS;
  if (phase === GUESS) return GIVE_CLUE;
  throw new Error(`wat: should not have unknown phase ${phase}`);
}

export default function gameReducer(state, action) {
  // reject invalid actions
  if (action.player.team !== state.team) return state;

  // handle skips - increment the phase and team, and make sure we don't have any guesses
  if (action.type === SKIP) return merge(state, {
    phase: nextPhase(state.phase),
    team: nextTeam(state.team),
    remainingGuesses: null,
  });

  // make sure we an actually execute this action
  // should we reject these here, or somewhere upsteam?
  // should we reject these by throwing execptions (eg UnknownWordError)?
  if (action.type !== state.phase) return state;
  if (action.type === GUESS && action.player.role !== GUESSER) return state;
  if (action.type === GIVE_CLUE && action.player.role !== SPYMASTER) return state;

  switch (action.type) {
  case GIVE_CLUE:
    // super simple - no wins / losses / etc just tick to next phase and record the clue
    return merge(state, {
      phase: nextPhase(state.phase),
      remainingGuesses: action.clue.count + 1,
      clueHistory: clueHistoryReducer(state.clueHistory, action),
    });
    break;
  case GUESS:
    const word = action.word;
    // unsure how i should handle this. i don't really want to track errors in the store
    if (!state.board.hasWord(word)) throw new UnknownWordError(word);
    const newBoard = state.board.dup();
    newBoard.pick(word);
    const correct = newBoard.statusOf(word) === state.team;
    const remainingGuesses = correct ? state.remainingGuesses - 1 : 0;

    // handle win/loss. if this action caused the kill word to be picked, the
    // current team loses.
    let winner = newBoard.getDepleted() || null;
    if (winner === KILL) winner = nextTeam(state.team);

    // switch team & phase?
    const team = remainingGuesses ? state.team : nextTeam(state.team);
    const phase = remainingGuesses ? state.phase : nextPhase(state.phase);

    return merge(state, {
      board: newBoard,
      remainingGuesses,
      team,
      phase,
      winner,
    });
  }

  throw new Error(`oops: should not be able to reach this (action.type: ${action.type})`);
}

// for now no Redux is involved

function clueHistoryReducer(clueHistory, action) {
  if (action.type !=== GIVE_CLUE) return clueHistory;
  return [...clueHistory, {team: action.player.team, clue: action.clue}];
}

function normalizeWord(word) {
  return word.trim().toUpperCase();
}

class UnknownWordError extends Error {};