import { Arg, Int, Query, Resolver, Mutation } from 'type-graphql';

import { Message, Channel, ChannelInput } from '../schemas/socket';
import { channelOpen, channelClose, channelSend, channelRetrieve } from '../services/service';

@Resolver()
export class SocketResolver {

  @Mutation(returns => Channel)
  public async open(@Arg("target") target: string): Promise<Channel> {
    return channelOpen(target);
  }

  @Mutation(returns => Boolean)
  public async close(@Arg("channel") channel: ChannelInput): Promise<Boolean> {
    return channelClose(channel);
  }

  @Mutation(returns => [Message])
  public async send(
    @Arg("channel") channel: ChannelInput,
    @Arg("message") message: string,
    @Arg("timeout", of => Int) timeout: number
  ): Promise<Message[]> {
    return channelSend(channel, message, timeout);
  }

  @Query(returns => [Message])
  public async retrieve(
    @Arg("channel") channel: ChannelInput,
    @Arg("timeout", of => Int) timeout: number
  ): Promise<Message[]> {
    return channelRetrieve(channel, timeout);
  }
}
