import {
  CommentResponse,
  GetCaptchaResponse,
  GetCommentsResponse,
  GetCommunityResponse,
  GetPersonDetailsResponse,
  GetPostResponse,
  GetPostsResponse,
  GetRepliesResponse,
  GetSiteResponse,
  GetUnreadCountResponse,
  LemmyHttp,
  ListCommunitiesResponse,
  PostResponse,
} from 'lemmy-js-client';
import { getReadableVersion } from 'react-native-device-info';
import { ISignupOptions } from '@api/common/types';
import { getBaseUrl } from '@helpers/links/getBaseUrl';
import { writeToLog } from '@helpers/LogHelper';
import ApiOptions from '@api/common/types/IApiOptions';
import { ILemmyVote } from '@api/lemmy/types';
import IGetPostOptions from '@api/common/types/IGetPostOptions';
import ICreatePostOptions from '@api/common/types/ICreatePostOptions';
import { useSettingsStore } from '@src/state/settings/settingsStore';
import { usePostStore } from '@src/state/post/postStore';
import { useFeedStore } from '@src/state/feed/feedStore';
import { cacheImages } from '@helpers/image';
import { getLinkType } from '@helpers/links/getLinkType';
import { truncateText } from '@helpers/text';
import { buildCommentChains } from '@helpers/comments';
import { addCommentsToPost } from '@src/state/post/actions';
import { addComments } from '@src/state/comment/actions';
import { useSiteStore } from '@src/state/site/siteStore';
import { useCommunityStore } from '@src/state/community/communityStore';

export enum EInitializeResult {
  SUCCESS,
  PASSWORD,
  TOTP,
  CAPTCHA,
  VERIFY_EMAIL,
}

class ApiInstance {
  apiType: 'lemmy' | 'kbin' = 'lemmy';

  username: string = '';

  instance: LemmyHttp | null = null; // TODO Kbin client will need to be added here

  captchaUuid: string | null = null;

  captchaPng: string | null = null;

  initialized: boolean = false;

  authToken: string | null = null;

  isUpdate: boolean = false;

  async initialize(
    options: ApiOptions,
    signup = false,
    signupOptions?: ISignupOptions,
  ): Promise<EInitializeResult> {
    this.username = options.username;
    this.apiType = 'lemmy';

    const headers = {
      'User-Agent': `Memmy ${getReadableVersion()}`,
      ...(options.authToken != null && {
        Authorization: `Bearer ${options.authToken}`,
      }),
    };

    if (options.type === 'lemmy') {
      this.instance = new LemmyHttp(`https://${getBaseUrl(options.host)}`, {
        fetchFunction: undefined,
        headers,
      });

      // We need to check the lemmy version real fast so we will just get and store the site here
      // TODO This should be done elsewhere later as to not block loading

      const siteRes = await this.instance.getSite();

      if (siteRes.version.includes('.19')) {
        this.isUpdate = true;
      }

      // Save the site info
      useSiteStore.getState().setSite(siteRes);

      if (options.authToken != null) {
        this.initialized = true;
        this.authToken = options.authToken;

        return EInitializeResult.SUCCESS;
      }

      if (signup) {
        try {
          if (options.password == null) {
            return EInitializeResult.PASSWORD;
          }

          const res = await this.instance.register({
            username: options.username,
            email: signupOptions?.email,
            password: options.password,
            password_verify: options.password,
            show_nsfw: signupOptions != null ? signupOptions.showNsfw : false,
            captcha_uuid: signupOptions?.captchaUuid ?? undefined,
            captcha_answer: signupOptions?.captchaAnswer,
          });

          if (res.verify_email_sent) {
            return EInitializeResult.VERIFY_EMAIL;
          }

          if (res.jwt == null) {
            return EInitializeResult.PASSWORD;
          }

          options.authToken = res.jwt;
          this.authToken = res.jwt;

          void this.initialize(options);

          return EInitializeResult.SUCCESS;
        } catch (e: any) {
          if (e.toString() === 'captcha_incorrect') {
            return EInitializeResult.CAPTCHA;
          }

          return EInitializeResult.PASSWORD;
        }
      }

      try {
        const res = await this.instance.login({
          username_or_email: options.username,
          password: options.password ?? '',
          totp_2fa_token: options.totpToken ?? undefined,
        });

        if (res.jwt == null) {
          return EInitializeResult.PASSWORD;
        }

        await this.initialize({
          ...options,
          authToken: res.jwt,
        });

        return EInitializeResult.SUCCESS;
      } catch (e: any) {
        this.resetInstance();

        if (e.toString() === 'missing_totp_token') {
          return EInitializeResult.TOTP;
        }

        return EInitializeResult.PASSWORD;
      }
    } else {
      return EInitializeResult.PASSWORD;
    }
  }

  resetInstance(): void {
    this.instance = null;
    this.initialized = false;
  }

  static handleError(error: string): string {
    // TODO Handle errors
    writeToLog(error);

    return 'Not implemented'; // TODO Return the error message
  }

  async getCaptcha(): Promise<GetCaptchaResponse | undefined> {
    try {
      return await this.instance?.getCaptcha();
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async savePost(postId: number, save: boolean): Promise<void> {
    try {
      await this.instance?.savePost({
        post_id: postId,
        save,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async likePost(postId: number, vote: ILemmyVote): Promise<void> {
    let oldValues = {
      score: 0,
      upvotes: 0,
      downvotes: 0,
    };

    usePostStore.setState((state) => {
      const post = state.posts.get(postId);

      if (post == null) return;

      oldValues = {
        score: post.view.counts.score,
        upvotes: post.view.counts.upvotes,
        downvotes: post.view.counts.downvotes,
      };

      if (
        (post.view.my_vote === 1 && vote === 1) ||
        (post.view.my_vote === -1 && vote === -1)
      ) {
        vote = 0;
      }

      if (post.view.my_vote === 1 && vote === 0) {
        post.view.counts.score = post.view.counts.score - 1;
        post.view.counts.upvotes = post.view.counts.upvotes - 1;
      } else if (post.view.my_vote === 1) {
        post.view.counts.score = post.view.counts.score - 2;
        post.view.counts.upvotes = post.view.counts.upvotes - 1;
        post.view.counts.downvotes = post.view.counts.downvotes + 1;
      } else if (post.view.my_vote === -1 && vote === 0) {
        post.view.counts.score = post.view.counts.score + 1;
        post.view.counts.downvotes = post.view.counts.downvotes - 1;
      } else if (post.view.my_vote === -1) {
        post.view.counts.score = post.view.counts.score + 2;
        post.view.counts.upvotes = post.view.counts.upvotes + 1;
        post.view.counts.downvotes = post.view.counts.downvotes - 1;
      } else if (post.view.my_vote === 0 || post.view.my_vote === undefined) {
        if (vote === 1) {
          post.view.counts.score = post.view.counts.score + 1;
          post.view.counts.upvotes = post.view.counts.upvotes + 1;
        } else {
          post.view.counts.score = post.view.counts.score - 1;
          post.view.counts.downvotes = post.view.counts.downvotes + 1;
        }
      }

      post.view.my_vote = vote;
    });

    try {
      await this.instance?.likePost({
        post_id: postId,
        score: vote,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      usePostStore.setState((state) => {
        const post = state.posts.get(postId);

        if (post == null) return;

        post.view.counts.score = oldValues.score;
        post.view.counts.upvotes = oldValues.upvotes;
        post.view.counts.downvotes = oldValues.downvotes;
      });

      const errMsg = ApiInstance.handleError(e.toString());
      throw new Error(errMsg);
    }
  }

  async likeComment(commentId: number, score: ILemmyVote): Promise<void> {
    try {
      await this.instance?.likeComment({
        comment_id: commentId,
        score,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async saveComment(commentId: number, save: boolean): Promise<void> {
    try {
      await this.instance?.saveComment({
        comment_id: commentId,
        save,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async getSite(): Promise<GetSiteResponse | undefined> {
    try {
      return await this.instance?.getSite();
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getUnreadCount(): Promise<GetUnreadCountResponse | undefined> {
    try {
      return await this.instance?.getUnreadCount();
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getPersonDetails(
    username: string,
  ): Promise<GetPersonDetailsResponse | undefined> {
    try {
      return await this.instance?.getPersonDetails({
        username,
        sort: 'New',
        limit: 50,
        page: 1,
        // @ts-expect-error TODO Remove this later
        auth: this.authToken,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getCommunity(
    name: string,
    addToStore = true,
  ): Promise<GetCommunityResponse | undefined | number> {
    try {
      const res = await this.instance?.getCommunity({
        name,
        // @ts-expect-error TODO Remove this later
        auth: this.authToken,
      });

      if (res == null) return undefined;
      if (!addToStore) return res;

      useCommunityStore.setState((state) => {
        state.communities.set(res.community_view.community.id, res);
      });

      return res.community_view.community.id;
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getReplies(
    page = 1,
    limit = 50,
  ): Promise<GetRepliesResponse | undefined> {
    try {
      return await this.instance?.getReplies({
        page,
        limit,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getPosts(
    feedId: string,
    options: IGetPostOptions = {},
    addToFeed = true,
  ): Promise<GetPostsResponse | undefined> {
    // Get settings
    const settings = useSettingsStore.getState();

    // Define default options
    const defaultOptions: IGetPostOptions = {
      limit: 10,
      page: 1,
      type: settings.defaultListingType,
      sort:
        // TODO This should use a separate option for feed vs community
        options.communityId != null || options.communityName != null
          ? settings.defaultSort
          : settings.defaultSort,
      refresh: false,
    };

    // Set all our options
    options = {
      ...defaultOptions,
      sort: 'TopDay',
      ...options,
    };

    // Attempt the request
    try {
      // Get the posts
      const res = await this.instance?.getPosts({
        sort: options.sort,
        type_: options.type,
        limit: options.limit,
        page: options.page,
        community_id: options.communityId,
        community_name: options.communityName,
        // @ts-expect-error TODO Remove this later
        auth: this.authToken,
      });

      const links: string[] = [];

      // Add them to the feed
      if (res != null && addToFeed) {
        // Create empty array of post ids
        const postIds: number[] = [];
        const currentPosts = useFeedStore.getState().feeds.get(feedId)?.postIds;

        usePostStore.setState((state) => {
          if (options.refresh === true) {
            state.posts.clear();
          }

          // Add each post to the state
          for (const post of res.posts) {
            const currentPost = state.posts.get(post.post.id);

            if (currentPost != null) {
              currentPost.usedBy.push(feedId);
            } else {
              state.posts.set(post.post.id, {
                view: post,
                usedBy: [feedId],
                linkType: getLinkType(post.post.url),
                bodyPreview: truncateText(post.post.body, 200),
              });
            }

            const index = currentPosts?.indexOf(post.post.id);

            if (index === -1) {
              postIds.push(post.post.id);

              if (post.post.url != null) {
                links.push(post.post.url);
              }
            }

            void cacheImages(links);
          }
        });

        // Add the post ids to the feed
        useFeedStore.setState((state) => {
          const feed = state.feeds.get(feedId);

          if (feed == null) {
            state.feeds.set(feedId, {
              feedId,
              postIds,
              nextPage: options.page! + 1,
            });
          } else {
            feed.postIds = [...feed.postIds, ...postIds];
            feed.nextPage = options.page! + 1;
          }
        });

        return undefined;
      }

      return res;
    } catch (e: any) {
      const errorMsg = ApiInstance.handleError(e.toString());

      throw new Error(errorMsg);
    }
  }

  async getPost(postId: number): Promise<GetPostResponse | undefined> {
    try {
      return await this.instance?.getPost({
        id: postId,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async getComments(
    postId: number,
    addToPost = true,
  ): Promise<GetCommentsResponse | undefined> {
    const settings = useSettingsStore.getState();
    const post = usePostStore.getState().posts.get(postId);

    if (post == null) return;

    try {
      const res = await this.instance?.getComments({
        post_id: postId,
        max_depth: 5,
        limit: 1,
        sort: settings.defaultCommentSort,
      });

      if (res === undefined || !addToPost) {
        return res;
      }

      const builtComments = buildCommentChains(res.comments);

      addCommentsToPost(postId, builtComments.commentInfo);
      addComments(res.comments);

      return res;
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async listCommunities(
    page = 1,
    limit = 50,
  ): Promise<ListCommunitiesResponse | undefined> {
    try {
      return await this.instance?.listCommunities({
        page,
        limit,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async markPostRead(postId: number): Promise<void> {
    try {
      await this.instance?.markPostAsRead({
        post_id: postId,
        read: true,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async subscribeCommunity(
    communityId: number,
    subscribe: boolean,
  ): Promise<void> {
    try {
      await this.instance?.followCommunity({
        community_id: communityId,
        follow: subscribe,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async reportComment(commentId: number, reason: string): Promise<void> {
    try {
      await this.instance?.createCommentReport({
        comment_id: commentId,
        reason,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async reportPost(postId: number, reason: string): Promise<void> {
    try {
      await this.instance?.createPostReport({
        post_id: postId,
        reason,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async blockUser(userId: number, block: boolean): Promise<void> {
    try {
      await this.instance?.blockPerson({
        person_id: userId,
        block,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async blockCommunity(communityId: number, block: boolean): Promise<void> {
    try {
      await this.instance?.blockCommunity({
        community_id: communityId,
        block,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async editComment(commentId: number, content: string): Promise<void> {
    try {
      await this.instance?.editComment({
        comment_id: commentId,
        content,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async createComment(
    postId: number,
    content: string,
  ): Promise<CommentResponse | undefined> {
    try {
      return await this.instance?.createComment({
        post_id: postId,
        content,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async createPost(
    options: ICreatePostOptions,
  ): Promise<PostResponse | undefined> {
    try {
      return await this.instance?.createPost({
        name: options.title,
        body: options.body,
        url: options.url,
        language_id: options.languageId ?? 0, // TODO Fix this
        community_id: options.communityId,
        nsfw: options.nsfw,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
      return undefined;
    }
  }

  async deleteComment(commentId: number): Promise<void> {
    try {
      await this.instance?.deleteComment({
        comment_id: commentId,
        deleted: true,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }

  async deletePost(postId: number): Promise<void> {
    try {
      await this.instance?.deletePost({
        post_id: postId,
        deleted: true,
        // @ts-expect-error TODO remove this later
        auth: this.authToken!,
      });
    } catch (e: any) {
      ApiInstance.handleError(e.toString());
    }
  }
}

export default ApiInstance;
