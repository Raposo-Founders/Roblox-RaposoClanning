import { HttpService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { HttpProvider } from "providers/HttpProvider";

// # Constants & variables
const CLANWARE_TOKEN = "a70ce003d4f5447bac60e50265b44268";

// # Functions
function fetchClanwareListed( listingType: "exploiters" | "degenerates", userId: number ) 
{
  const payload = HttpService.JSONEncode( {
    robloxIds: [tostring( userId )],
    showArchived: false,
  } );

  return HttpProvider.Request( {
    Url: `https://justice.clanware.org/api/justice/${listingType}`,
    Method: "POST",
    Headers: {
      Authorization: CLANWARE_TOKEN,
      "Content-Type": "application/json",
    },
    Body: payload,
  } );
}

function validateClanwareResult( result: string ): boolean 
{
  const [isJson, decodeResult] = pcall<[], unknown[]>( () => HttpService.JSONDecode( result ) as unknown[] );

  if ( !isJson ) return false;
  if ( t.array( t.any )( decodeResult ) && decodeResult.size() > 0 ) return true;
  return false;
}

// # Namespace
export namespace ClanwareCaseSystem {
  export function IsUserListed( userId: number ) 
  {

    return {
      exploiter: validateClanwareResult( tostring( fetchClanwareListed( "exploiters", userId ) ) ),
      degenerate: validateClanwareResult( tostring( fetchClanwareListed( "degenerates", userId ) ) ),
    };
  }
}

// # Bindings & misc