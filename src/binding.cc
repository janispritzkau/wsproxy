#include <node.h>
#include <v8.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <linux/netfilter_ipv4.h>

void GetOriginalDestination(const v8::FunctionCallbackInfo<v8::Value> &args)
{
    v8::Isolate *isolate = args.GetIsolate();

    int fd = args[0]->Int32Value();

    struct sockaddr_in dest_addr;
    socklen_t sock_len = sizeof(dest_addr);

    if (getsockopt(fd, SOL_IP, SO_ORIGINAL_DST, &dest_addr, &sock_len) != 0) {
        isolate->ThrowException(v8::Exception::Error(
            v8::String::NewFromUtf8(isolate, "getsockopt failed to get original destination!")
        ));
    }

    char hostname[256] = {};
    int port = ntohs(dest_addr.sin_port);

    inet_ntop(AF_INET, reinterpret_cast<void *>(&dest_addr.sin_addr), hostname, 256);

    auto arr = v8::Array::New(isolate, 2);
    arr->Set(0, v8::String::NewFromUtf8(isolate, hostname));
    arr->Set(1, v8::Number::New(isolate, port));

    args.GetReturnValue().Set(arr);
}

void Init(v8::Local<v8::Object> exports)
{
    NODE_SET_METHOD(exports, "getOriginalDest", GetOriginalDestination);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Init)
