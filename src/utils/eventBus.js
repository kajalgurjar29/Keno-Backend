import { EventEmitter } from "events";

class AppEventEmitter extends EventEmitter { }

const eventBus = new AppEventEmitter();

// Event Constants
export const EVENTS = {
    USER_REGISTERED: "user.registered",
    USER_LOGGED_IN: "user.login",
    PROFILE_UPDATED: "user.profile_update",
    PASSWORD_CHANGED: "user.password_change",
    SUBSCRIPTION_PURCHASED: "payment.subscription",
    NEW_RESULT_PUBLISHED: "result.published", // { type: 'KENO'|'TRACKSIDE', location: 'NSW'.. , data: {..} }
    ALERT_TRIGGERED: "alert.triggered",
};

export default eventBus;
