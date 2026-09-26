export const EventManager={on(target,event,handler,opts){target.addEventListener(event,handler,opts);return()=>target.removeEventListener(event,handler,opts)}};
