import { Length, MaxLength } from "class-validator";
import { Field, ID, InputType, ObjectType, registerEnumType } from "type-graphql";

@ObjectType()
export class Channel {
  @Field()
  public target: string;

  @Field()
  public correlationKey: string;
}

@ObjectType()
export class Message {
  @Field()
  public source: string;

  @Field()
  public correlationKey: string;

  @Field()
  public raw: string;
}
