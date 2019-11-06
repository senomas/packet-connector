import { Field, InputType, ObjectType } from "type-graphql";

@ObjectType()
export class Channel {
  @Field()
  public target: string;

  @Field()
  public channelKey: string;
}

@InputType()
export class ChannelInput {
  @Field()
  public target: string;

  @Field()
  public channelKey: string;
}

@ObjectType()
export class Message {
  @Field()
  public source: string;

  @Field(of => Date)
  public time: Date;

  @Field({ nullable: true })
  public correlationKey?: string;

  @Field()
  public raw: string;
}
