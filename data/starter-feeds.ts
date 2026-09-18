export interface StarterFeed {
  title: string;
  feedUrl: string;
  siteUrl: string;
  attribution: string;
  topic: string;
}

export const starterFeeds: StarterFeed[] = [
  {
    title: "BBC World News",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    siteUrl: "https://www.bbc.com/news/world",
    attribution: "BBC News",
    topic: "World news"
  },
  {
    title: "NASA Recently Published",
    feedUrl: "https://www.nasa.gov/feed/",
    siteUrl: "https://www.nasa.gov/",
    attribution: "NASA",
    topic: "Space and science"
  },
  {
    title: "The Conversation",
    feedUrl: "https://theconversation.com/us/articles.atom",
    siteUrl: "https://theconversation.com/us",
    attribution: "The Conversation",
    topic: "Academic analysis"
  },
  {
    title: "Smithsonian Smart News",
    feedUrl: "https://www.smithsonianmag.com/rss/smart-news/",
    siteUrl: "https://www.smithsonianmag.com/smart-news/",
    attribution: "Smithsonian Magazine",
    topic: "History and science"
  },
  {
    title: "ScienceDaily",
    feedUrl: "https://www.sciencedaily.com/rss/top/science.xml",
    siteUrl: "https://www.sciencedaily.com/",
    attribution: "ScienceDaily",
    topic: "Science research"
  },
  {
    title: "NPR Science",
    feedUrl: "https://feeds.npr.org/1007/rss.xml",
    siteUrl: "https://www.npr.org/sections/science/",
    attribution: "NPR",
    topic: "Science and society"
  }
];
