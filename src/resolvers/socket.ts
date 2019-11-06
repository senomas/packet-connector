import { Arg, Int, Query, Resolver, Mutation } from 'type-graphql';

import { Message, Channel } from '../schemas/socket';

@Resolver()
export class SocketResolver {

  @Mutation(returns => Channel)
  public async open(@Arg("target") target: string): Promise<Channel> {
    return null;
  }

  @Mutation(returns => Boolean)
  public async close(@Arg("channel") channel: Channel): Promise<Boolean> {
    return null;
  }

  @Mutation(returns => Channel)
  public async send(@Arg("target", { nullable: true }) target: string, @Arg("channel", { nullable: true }) channel: Channel, @Arg("message") message: Message): Promise<Channel> {
    return channel;
  }

  @Query(returns => Message)
  public async retrieve(@Arg("target", { nullable: true }) target: string, @Arg("channel", { nullable: true }) channel: Channel, @Arg("timeout", of => Int) timeout: number): Promise<Message> {
    return null;
  }
}
