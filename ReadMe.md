# Bounan Ongoing

Monitors and tracks ongoing anime series by their downloaded episodes,
ensuring that newly available episodes are registered with downstream services.

## Actions:

- When a new video is registered, it:
  - if the anime is an ongoing, updates list of registered episodes
  - otherwise, takes no action

- 4 times a day:
  - re-checks ongoing anime for newly available episodes and notifies AniMan about them
  - cleans up completed ongoings from the tracking table in 2 cases:
    - if all expected episodes have been downloaded
    - if the ongoing has been inactive for a month

## Database:

- Bounan Ongoing Table (DynamoDB):
  - animeKey (partition key, derived from `myAnimeListId + dub`)
  - myAnimeListId (number)
  - dub (string)
  - episodes (set<number>)
  - updatedAt (ISO string)
  - createdAt (ISO string)

## External Connections

### Events Subscribed

- on-video-registered events (SNS)
- Scheduled events (EventBridge)

### Events Published

None

### Used APIs:

- AniMan Lambda
- [Shikimori API](https://shikimori.one/api/doc)
- LoanAPI

### Provided APIs

None

---

## Legal Notice

This project does **not** host, distribute, or provide access to copyrighted content.

Bounan operates exclusively on metadata and event orchestration
and is intended to be used only with content sources and services that
the user has the legal right to access.

The authors of this project do not endorse or encourage the use of this
software for copyright infringement or any unlawful activity.

Responsibility for compliance with applicable laws and regulations
lies solely with the user of the software.

### License

This project is licensed under the BSD 3-Clause License.

See the LICENSE file for details.