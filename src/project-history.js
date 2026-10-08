export function historyState(present) {
  return { present, past: [], future: [], group: null, time: 0 };
}
export function historyReducer(state, action) {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      present: state.past.at(-1),
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future].slice(0, 40),
      group: null,
      time: 0,
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      present: state.future[0],
      past: [...state.past, state.present].slice(-40),
      future: state.future.slice(1),
      group: null,
      time: 0,
    };
  }
  if (action.type !== "edit") return state;
  const present =
    typeof action.value === "function"
      ? action.value(state.present)
      : action.value;
  if (
    present === state.present ||
    JSON.stringify(present) === JSON.stringify(state.present)
  )
    return state;
  const grouped =
    action.group &&
    state.group === action.group &&
    action.time - state.time < 800;
  return {
    present,
    past: grouped ? state.past : [...state.past, state.present].slice(-40),
    future: [],
    group: action.group || null,
    time: action.time || 0,
  };
}
