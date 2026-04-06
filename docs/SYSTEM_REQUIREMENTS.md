# System Requirements

This document outlines the business rules and system requirements for the anime tracking application.

## Common Notes

1. General purpose of the system is to track ongoing anime series and their episodes, ensuring
   that newly available episodes are registered with downstream services.
2. On the system side, Anime is identified by a unique combination of `myAnimeListId` and `dub`.
3. Number of expected episodes for an anime is determined by external Library API (e.g., Jikan).
   If the API does not provide episode information, the system assumes that the anime is not complete.
4. An anime is considered "complete" when all expected episodes have been registered in the database.
5. An anime is considered "inactive" if no new episodes have been registered for it in the last month.
6. On any error (e.g., API failure), the system should log the error and take no further action for that event.
   No other requirement for error handling is defined.

## on-video-registered

WARNING: This concept does not match the current implementation.
No validation for completeness or ongoing status is currently implemented.

The endpoint is triggered when a new episode is registered in the system, to check if the anime is ongoing
and if it should be added to the database.

### Entities

1. IsComplete: Yes/No
2. Registration status:
   - Not Registered: Anime is not registered
   - Anime Registered: Anime is registered, episode is not registered
   - Episode Registered: Anime is registered, episode is registered
3. Ongoing status: Ongoing/Not Ongoing [^1]

### Test Cases

| Test Case ID | IsComplete | Registration Status | Ongoing status | Expected Outcome                  |
|--------------|------------|---------------------|----------------|-----------------------------------|
| REQ-OVR-01   | Yes        | *                   | *              | No action taken                   |
| REQ-OVR-02   | No         | Not Registered      | Not Ongoing    | No action taken                   |
| REQ-OVR-02   | No         | Not Registered      | Ongoing        | Anime and Episode are added to DB |
| REQ-OVR-03   | No         | Anime Registered    | *              | Episode is added to DB            |
| REQ-OVR-04   | No         | Episode Registered  | *              | No action taken                   |

[^1]: Despite we can determine if an anime is ongoing or not based on the number of expected episodes, we use
the Ongoing Status from the API to avoid registering an anime that are abandoned by dubbers. It is assumed that if
an anime is newly registered, is not ongoing, and is not complete, it is likely an abandoned anime.
There can be edge cases where an anime is registered right before the last episode is released, though.

## on-schedule

The endpoint is triggered on a schedule (every 3 hours) to check for new episodes of ongoing anime series.

### Entities

1. Number of new episodes: 0, 1, Multiple
2. Inactivity status: Active/Inactive
3. IsComplete: Yes/No

### Test Cases

| Test Case ID | Activity | IsComplete | New Episodes | Expected Outcome                    |
|--------------|----------|------------|--------------|-------------------------------------|
| REQ-OS-01    | Inactive | *          | *            | Anime is removed from DB            |
| REQ-OS-02    | Active   | Yes        | *            | Anime is removed from DB            |
| REQ-OS-03    | Active   | No         | 0            | No action taken                     |
| REQ-OS-04    | Active   | No         | 1            | Notification with new episode sent  |
| REQ-OS-05    | Active   | No         | Multiple     | Notification with new episodes sent |
